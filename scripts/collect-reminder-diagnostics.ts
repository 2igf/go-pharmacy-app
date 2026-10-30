import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE = "com.gopharmacy.beta";
export function safeAlarmSummary(raw: string) {
  const lines = raw.split(/\r?\n/),
    result: {
      type: string;
      requestedEpochMs: number | null;
      whenElapsedMs: number | null;
    }[] = [];
  for (const line of lines) {
    const kind = line.match(
      /^\s*(RTC_WAKEUP|RTC|ELAPSED_REALTIME_WAKEUP|ELAPSED_REALTIME|ELAPSED_WAKEUP|ELAPSED)\s+#\d+:/
    );
    if (
      !kind ||
      !new RegExp(PACKAGE.replaceAll(".", "\\.") + "(?=[\\s}])").test(line)
    )
      continue;
    result.push({
      type: kind[1],
      requestedEpochMs: line.match(/\borigWhen\s+(\d+)/)?.[1]
        ? Number(line.match(/\borigWhen\s+(\d+)/)![1])
        : null,
      whenElapsedMs: line.match(/\bwhenElapsed\s+(\d+)/)?.[1]
        ? Number(line.match(/\bwhenElapsed\s+(\d+)/)![1])
        : null,
    });
  }
  return result;
}
export function safeReminderLogs(raw: string) {
  const allowed = new Set([
    "pending_retained",
    "clock_reconciled",
    "alarm_scheduled",
    "alarm_cancelled",
    "account_plan_cleared",
    "alarm_received",
    "notification_posted",
  ]);
  return raw
    .split(/\r?\n/)
    .flatMap(line => {
      const m = line.match(
        /\bevent=([a-z_]+) reminderId=(\d+) epochMs=(\d+)\s*$/
      );
      return m && allowed.has(m[1])
        ? [{ event: m[1], reminderId: Number(m[2]), epochMs: Number(m[3]) }]
        : [];
    })
    .slice(-500);
}
export function safeNativeProbe(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>,
    result: Record<string, unknown> = {};
  for (const key of ["deviceNowEpochMs", "androidApi", "channelImportance"])
    if (typeof v[key] === "number" && Number.isFinite(v[key]))
      result[key] = v[key];
  for (const key of [
    "postPermissionGranted",
    "globalNotificationsEnabled",
    "channelExists",
    "exactAlarmAccess",
    "stateReadable",
    "encryptedCustomerPlanUnchanged",
    "testNotificationActiveInAndroid",
  ])
    if (typeof v[key] === "boolean") result[key] = v[key];
  if (
    typeof v.timezone === "string" &&
    /^[A-Za-z0-9_+\-/]{1,80}$/.test(v.timezone)
  )
    result.timezone = v.timezone;
  if (Array.isArray(v.nativeEntries))
    result.nativeEntries = v.nativeEntries.slice(0, 20).map((row: unknown) => {
      const item: Record<string, unknown> = {},
        r =
          row && typeof row === "object"
            ? (row as Record<string, unknown>)
            : {};
      for (const key of ["reminderId", "nativeId", "nextEpochMs"])
        if (typeof r[key] === "number" && Number.isFinite(r[key]))
          item[key] = r[key];
      for (const key of ["enabled", "pendingIntentExists"])
        if (typeof r[key] === "boolean") item[key] = r[key];
      return item;
    });
  return result;
}
function main() {
  const args = process.argv.slice(2),
    argument = (name: string) => args[args.indexOf(name) + 1];
  if (!args.includes("--serial") || !args.includes("--adb"))
    throw Error(
      "Supply explicit --serial and --adb; no device is selected automatically"
    );
  const serial = argument("--serial"),
    adb = argument("--adb");
  if (!serial || !adb || !fs.existsSync(adb))
    throw Error("Invalid explicit ADB path or device");
  const run = (values: string[]) => {
    try {
      return execFileSync(adb, ["-s", serial, ...values], {
        encoding: "utf8",
        timeout: 20000,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      throw Error(
        "A read-only ADB collection step failed; no raw device output was printed"
      );
    }
  };
  const pkg = run(["shell", "dumpsys", "package", PACKAGE]);
  const epoch = Number(run(["shell", "date", "+%s"]).trim());
  const report: Record<string, unknown> = {
    collectedAt: new Date().toISOString(),
    package: PACKAGE,
    readOnly: true,
    rawDumpsPersisted: false,
    emulator: run(["shell", "getprop", "ro.kernel.qemu"]).trim() === "1",
    androidApi: Number(
      run(["shell", "getprop", "ro.build.version.sdk"]).trim()
    ),
    manufacturer: run(["shell", "getprop", "ro.product.manufacturer"]).trim(),
    model: run(["shell", "getprop", "ro.product.model"]).trim(),
    deviceEpochMs: Number.isFinite(epoch) ? epoch * 1000 : null,
    deviceTimezone: run(["shell", "getprop", "persist.sys.timezone"]).trim(),
    versionCode: pkg.match(/versionCode=(\d+)/)?.[1] ?? null,
    versionName: pkg.match(/versionName=([^\s]+)/)?.[1] ?? null,
    notificationPermissionGranted:
      /android\.permission\.POST_NOTIFICATIONS:\s*granted=true/.test(pkg),
    nativeAlarms: safeAlarmSummary(run(["shell", "dumpsys", "alarm"])),
  };
  let pid = "";
  try {
    pid = run(["shell", "pidof", PACKAGE]).trim().split(/\s+/)[0];
  } catch {
    /* A stopped app is evidence; never start it for collection. */
  }
  report.structuredAppEvents =
    pid && /^\d+$/.test(pid)
      ? safeReminderLogs(
          run([
            "shell",
            "logcat",
            "-d",
            "--pid=" + pid,
            "-v",
            "epoch",
            "-s",
            "GoReminders:I",
            "*:S",
          ])
        )
      : [];
  try {
    report.lastNativeProbe = safeNativeProbe(
      JSON.parse(
        run([
          "exec-out",
          "run-as",
          PACKAGE,
          "cat",
          "files/reminder-probe-safe.json",
        ])
      )
    );
  } catch {
    report.lastNativeProbe =
      "not available; do not restart or instrument the app automatically";
  }
  const directory = path.resolve(
    ".local",
    "honor-notification-evidence",
    new Date().toISOString().replace(/[:.]/g, "-")
  );
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "summary.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(
    JSON.stringify(
      {
        savedTo: path.join(directory, "summary.json"),
        emulator: report.emulator,
        readOnly: true,
        rawDumpsPersisted: false,
      },
      null,
      2
    )
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Diagnostic collection failed"
    );
    process.exitCode = 1;
  }
}
