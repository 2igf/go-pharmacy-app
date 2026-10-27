import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertMigrationTarget,
  acceptedMigrationHashes,
  assertMigrationHistory,
} from "../scripts/migration-policy";
describe("migration target guard", () => {
  it("refuses partial or untracked fulfillment DDL and allows the intact additive prefix", () => {
    const local = [
      { when: 4, tag: "0004_pharmacy_tenancy", hashes: ["t"] },
      { when: 5, tag: "0005_simulated_fulfillment", hashes: ["f"] },
    ];
    const prefix = [{ created_at: 4, hash: "t" }];
    expect(() => assertMigrationHistory(local, prefix, 7, 0)).not.toThrow();
    expect(() => assertMigrationHistory(local, prefix, 7, 1)).toThrow(
      /fulfillment/i
    );
    expect(() =>
      assertMigrationHistory(
        local,
        [...prefix, { created_at: 5, hash: "f" }],
        7,
        2
      )
    ).toThrow(/fulfillment/i);
    expect(() =>
      assertMigrationHistory(
        local,
        [...prefix, { created_at: 5, hash: "f" }],
        7,
        3
      )
    ).not.toThrow();
  });
  it("allows a future pending migration after 0004, but rejects partial DDL and skipped history", () => {
    const local = [
      { when: 1, tag: "0000_base", hashes: ["base"] },
      { when: 4, tag: "0004_pharmacy_tenancy", hashes: ["tenant"] },
      { when: 5, tag: "0005_future", hashes: ["future"] },
    ];
    const applied = [
      { created_at: 1, hash: "base" },
      { created_at: 4, hash: "tenant" },
    ];
    expect(() => assertMigrationHistory(local, applied, 7)).not.toThrow();
    expect(() => assertMigrationHistory(local, applied, 6)).toThrow(/Partial/);
    expect(() => assertMigrationHistory(local, applied.slice(1), 7)).toThrow(
      /journal/
    );
    expect(() => assertMigrationHistory(local, applied.slice(0, 1), 7)).toThrow(
      /Partial/
    );
  });
  it("keeps every generated MySQL migration identifier within 64 characters", () => {
    const migration =
      readFileSync("drizzle/0004_pharmacy_tenancy.sql", "utf8") +
      readFileSync("drizzle/0005_simulated_fulfillment.sql", "utf8");
    expect(
      [...migration.matchAll(/`([^`]+)`/g)]
        .filter(match => match[1].length > 64)
        .map(match => match[1])
    ).toEqual([]);
  });
  it("accepts exact LF/CRLF equivalents but rejects SQL changes", () => {
    const unix = acceptedMigrationHashes("CREATE TABLE sample (id int);\n");
    const windows = acceptedMigrationHashes(
      "CREATE TABLE sample (id int);\r\n"
    );
    expect(unix).toEqual(windows);
    expect(
      acceptedMigrationHashes("CREATE TABLE sample (id text);\n")
    ).not.toEqual(unix);
  });
  it("allows only explicitly matched disposable test databases by default", () => {
    expect(
      assertMigrationTarget(
        "mysql://test@127.0.0.1/go_pharmacy_test",
        "go_pharmacy_test"
      )
    ).toBe("go_pharmacy_test");
    expect(() =>
      assertMigrationTarget(
        "mysql://test@127.0.0.1/go_pharmacy_test",
        undefined
      )
    ).toThrow();
    expect(() =>
      assertMigrationTarget(
        "mysql://test@127.0.0.1/go_pharmacy_demo",
        "go_pharmacy_test"
      )
    ).toThrow();
  });
  it("refuses demo/data migrations without both deliberate operational acknowledgements", () => {
    const url = "mysql://test@127.0.0.1/go_pharmacy_demo";
    expect(() => assertMigrationTarget(url, "go_pharmacy_demo")).toThrow();
    expect(() =>
      assertMigrationTarget(url, "go_pharmacy_demo", "go_pharmacy_demo")
    ).toThrow();
    expect(() =>
      assertMigrationTarget(
        url,
        "go_pharmacy_demo",
        "go_pharmacy_demo",
        "another_database"
      )
    ).toThrow();
    expect(
      assertMigrationTarget(
        url,
        "go_pharmacy_demo",
        "go_pharmacy_demo",
        "go_pharmacy_demo"
      )
    ).toBe("go_pharmacy_demo");
  });
});
