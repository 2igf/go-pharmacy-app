package com.gopharmacy.beta;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.GregorianCalendar;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

/** Pure wall-clock recurrence, usable on the application's existing API 24 minimum. */
final class ReminderDefinition {
    static final String PUBLIC_BODY = "حان وقت تذكيرك الصحي";
    final int id;
    final String medicationName, startDate, endDate;
    final List<String> times;
    final List<Integer> weekdays;
    final boolean enabled, discreet;

    ReminderDefinition(int id, String medicationName, List<String> times, List<Integer> weekdays,
                       String startDate, String endDate, boolean enabled, boolean discreet) {
        if (id <= 0 || medicationName == null || medicationName.trim().isEmpty() || medicationName.length() > 160
                || medicationName.chars().anyMatch(Character::isISOControl)) throw new IllegalArgumentException("Invalid reminder identity");
        if (times == null || times.isEmpty() || times.size() > 8 || new HashSet<>(times).size() != times.size())
            throw new IllegalArgumentException("Choose one to eight unique times");
        for (String time : times) {
            if (time == null || !time.matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]")) throw new IllegalArgumentException("Invalid reminder time");
        }
        if (weekdays == null || weekdays.isEmpty() || weekdays.size() > 7 || new HashSet<>(weekdays).size() != weekdays.size())
            throw new IllegalArgumentException("Choose unique weekdays");
        for (Integer day : weekdays) if (day == null || day < 0 || day > 6) throw new IllegalArgumentException("Invalid weekday");
        validateDate(startDate);
        if (endDate != null) {
            validateDate(endDate);
            if (endDate.compareTo(startDate) < 0) throw new IllegalArgumentException("End date precedes start date");
        }
        this.id = id;
        this.medicationName = medicationName.trim();
        ArrayList<String> sortedTimes = new ArrayList<>(times);
        Collections.sort(sortedTimes);
        this.times = Collections.unmodifiableList(sortedTimes);
        this.weekdays = Collections.unmodifiableList(new ArrayList<>(weekdays));
        this.startDate = startDate;
        this.endDate = endDate;
        this.enabled = enabled;
        this.discreet = discreet;
    }

    static void validateAccount(String account) {
        if (account == null || account.length() < 5 || account.length() > 512 || account.chars().anyMatch(Character::isISOControl)
                || !account.matches("https://[^|]+\\|[1-9][0-9]*")) throw new IllegalArgumentException("Invalid account key");
        try {
            java.net.URI origin = new java.net.URI(account.substring(0, account.lastIndexOf('|')));
            if (origin.getHost() == null || origin.getUserInfo() != null || origin.getQuery() != null || origin.getFragment() != null
                    || (origin.getRawPath() != null && !origin.getRawPath().isEmpty())) throw new IllegalArgumentException("Account must use an HTTPS origin");
        } catch (java.net.URISyntaxException e) { throw new IllegalArgumentException("Invalid account origin"); }
    }

    private static void validateDate(String value) {
        if (value == null || !value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}") || value.compareTo("1970-01-01") < 0)
            throw new IllegalArgumentException("Invalid date");
        GregorianCalendar date = new GregorianCalendar(TimeZone.getTimeZone("UTC"), Locale.ROOT);
        date.setLenient(false);
        date.clear();
        date.set(Integer.parseInt(value.substring(0, 4)), Integer.parseInt(value.substring(5, 7)) - 1,
                Integer.parseInt(value.substring(8, 10)), 12, 0);
        try { date.getTimeInMillis(); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Invalid date"); }
    }

    /** Skip missing spring wall times; an autumn overlap uses the later offset once. Never catch up a missed dose. */
    boolean withinDateRange(long nowMillis, TimeZone zone) {
        Calendar day = new GregorianCalendar(zone, Locale.ROOT);
        day.setTimeInMillis(nowMillis);
        String today = dateKey(day);
        return today.compareTo(startDate) >= 0 && (endDate == null || today.compareTo(endDate) <= 0);
    }

    Long next(long nowMillis, TimeZone zone) {
        if (!enabled) return null;
        Calendar day = new GregorianCalendar(zone, Locale.ROOT);
        day.setTimeInMillis(nowMillis);
        String today = dateKey(day);
        if (endDate != null && today.compareTo(endDate) > 0) return null;
        if (today.compareTo(startDate) < 0) {
            day.clear();
            day.set(Integer.parseInt(startDate.substring(0, 4)), Integer.parseInt(startDate.substring(5, 7)) - 1,
                    Integer.parseInt(startDate.substring(8, 10)), 12, 0);
        }
        day.set(Calendar.HOUR_OF_DAY, 12);
        day.set(Calendar.MINUTE, 0);
        day.set(Calendar.SECOND, 0);
        day.set(Calendar.MILLISECOND, 0);
        for (int offset = 0; offset < 8; offset++) {
            if (endDate != null && dateKey(day).compareTo(endDate) > 0) return null;
            if (weekdays.contains(day.get(Calendar.DAY_OF_WEEK) - 1)) {
                Long best = null;
                for (String time : times) {
                    Calendar occurrence = new GregorianCalendar(zone, Locale.ROOT);
                    occurrence.clear();
                    int hour = Integer.parseInt(time.substring(0, 2)), minute = Integer.parseInt(time.substring(3, 5));
                    occurrence.set(day.get(Calendar.YEAR), day.get(Calendar.MONTH), day.get(Calendar.DAY_OF_MONTH), hour, minute, 0);
                    long at = occurrence.getTimeInMillis();
                    if (at > nowMillis && dateKey(occurrence).equals(dateKey(day))
                            && occurrence.get(Calendar.HOUR_OF_DAY) == hour && occurrence.get(Calendar.MINUTE) == minute
                            && (best == null || at < best)) best = at;
                }
                if (best != null) return best;
            }
            day.add(Calendar.DAY_OF_MONTH, 1);
        }
        return null;
    }

    private static String dateKey(Calendar day) {
        return String.format(Locale.ROOT, "%04d-%02d-%02d", day.get(Calendar.YEAR), day.get(Calendar.MONTH) + 1, day.get(Calendar.DAY_OF_MONTH));
    }

    String notificationBody() { return discreet ? PUBLIC_BODY : PUBLIC_BODY + ": " + medicationName; }

    static int notificationId(String account, int reminderId) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest((account + "|" + reminderId).getBytes(StandardCharsets.UTF_8));
            int value = ((hash[0] & 0x7f) << 24) | ((hash[1] & 0xff) << 16) | ((hash[2] & 0xff) << 8) | (hash[3] & 0xff);
            return value == 0 ? 1 : value;
        } catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }

    static int reserveId(int value, Set<Integer> used) {
        while (!used.add(value)) value = value == Integer.MAX_VALUE ? 1 : value + 1;
        return value;
    }
}
