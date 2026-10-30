package com.gopharmacy.beta;

import static org.junit.Assert.*;
import java.util.Arrays;
import java.util.Collections;
import java.util.TimeZone;
import java.time.Instant;
import org.junit.Test;

/** These expectations are literal instants, independent of the recurrence implementation. */
public class ReminderDefinitionTest {
    private ReminderDefinition reminder(String[] times, Integer[] days, String start, String end) {
        return new ReminderDefinition(7, "Private medicine", Arrays.asList(times), Arrays.asList(days), start, end, true, true);
    }
    private Long next(ReminderDefinition r, String now, String zone) {
        return r.next(Instant.parse(now).toEpochMilli(), TimeZone.getTimeZone(zone));
    }
    private long instant(String value) { return Instant.parse(value).toEpochMilli(); }

    @Test public void choosesNextTimeAndCrossesMidnight() {
        ReminderDefinition r = reminder(new String[]{"08:00", "20:00"}, new Integer[]{0,1,2,3,4,5,6}, "2026-01-01", null);
        assertEquals(Long.valueOf(instant("2026-10-29T17:00:00Z")), next(r, "2026-10-29T06:00:00Z", "Asia/Amman"));
        assertEquals(Long.valueOf(instant("2026-10-30T05:00:00Z")), next(r, "2026-10-29T17:00:00Z", "Asia/Amman"));
    }
    @Test public void respectsWeekdaysAndInclusiveDateBounds() {
        ReminderDefinition r = reminder(new String[]{"08:00"}, new Integer[]{1}, "2026-11-02", "2026-11-02");
        assertEquals(Long.valueOf(instant("2026-11-02T08:00:00Z")), next(r, "2026-10-29T08:00:00Z", "UTC"));
        assertNull(next(r, "2026-11-02T08:00:00Z", "UTC"));
    }
    @Test public void javascriptSundayZeroIsSunday() {
        ReminderDefinition r = reminder(new String[]{"09:00"}, new Integer[]{0}, "2026-01-01", null);
        assertEquals(Long.valueOf(instant("2026-11-01T09:00:00Z")), next(r, "2026-10-31T10:00:00Z", "UTC"));
    }
    @Test public void springGapIsSkippedAndAutumnOverlapDeliversOnce() {
        ReminderDefinition r = reminder(new String[]{"02:30"}, new Integer[]{0,1,2,3,4,5,6}, "2026-01-01", null);
        assertEquals(Long.valueOf(instant("2026-03-09T06:30:00Z")), next(r, "2026-03-08T06:00:00Z", "America/New_York"));
        ReminderDefinition overlap = reminder(new String[]{"01:30"}, new Integer[]{0,1,2,3,4,5,6}, "2026-01-01", null);
        assertEquals(Long.valueOf(instant("2026-11-01T06:30:00Z")), next(overlap, "2026-11-01T04:00:00Z", "America/New_York"));
        assertEquals(Long.valueOf(instant("2026-11-02T06:30:00Z")), next(overlap, "2026-11-01T06:30:00Z", "America/New_York"));
    }
    @Test public void timezoneChangeKeepsLocalClockTime() {
        ReminderDefinition r = reminder(new String[]{"08:00"}, new Integer[]{0,1,2,3,4,5,6}, "2026-01-01", null);
        assertEquals(Long.valueOf(instant("2026-10-29T08:00:00Z")), next(r, "2026-10-29T00:00:00Z", "UTC"));
        assertEquals(Long.valueOf(instant("2026-10-29T05:00:00Z")), next(r, "2026-10-29T00:00:00Z", "Asia/Amman"));
    }
    @Test public void disabledAndExpiredHaveNoOccurrence() {
        ReminderDefinition r = new ReminderDefinition(1, "Medicine", Collections.singletonList("08:00"), Collections.singletonList(4), "2026-01-01", null, false, true);
        assertNull(next(r, "2026-10-29T00:00:00Z", "UTC"));
        assertNull(next(reminder(new String[]{"08:00"}, new Integer[]{4}, "2026-01-01", "2026-01-02"), "2026-10-29T00:00:00Z", "UTC"));
    }
    @Test public void malformedDatesTimesAndDuplicateValuesAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> reminder(new String[]{"24:00"}, new Integer[]{1}, "2026-01-01", null));
        assertThrows(IllegalArgumentException.class, () -> reminder(new String[]{"8:00"}, new Integer[]{1}, "2026-01-01", null));
        assertThrows(IllegalArgumentException.class, () -> reminder(new String[]{"08:00", "08:00"}, new Integer[]{1}, "2026-01-01", null));
        assertThrows(IllegalArgumentException.class, () -> reminder(new String[]{"08:00"}, new Integer[]{7}, "2026-01-01", null));
        assertThrows(IllegalArgumentException.class, () -> reminder(new String[]{"08:00"}, new Integer[]{1,1}, "2026-01-01", null));
        assertThrows(IllegalArgumentException.class, () -> reminder(new String[]{"08:00"}, new Integer[]{1}, "2026-02-30", null));
        assertThrows(IllegalArgumentException.class, () -> reminder(new String[]{"08:00"}, new Integer[]{1}, "2026-01-02", "2026-01-01"));
    }
    @Test public void discreetContentOmitsMedicationAndPublicContentIsAlwaysGeneric() {
        ReminderDefinition r = reminder(new String[]{"08:00"}, new Integer[]{1}, "2026-01-01", null);
        assertFalse(r.notificationBody().contains("Private medicine"));
        ReminderDefinition explicit = new ReminderDefinition(2, "Private medicine", r.times, r.weekdays, r.startDate, null, true, false);
        assertTrue(explicit.notificationBody().contains("Private medicine"));
        assertFalse(ReminderDefinition.PUBLIC_BODY.contains("Private medicine"));
    }
    @Test public void idsArePositiveAccountScopedAndResolveHashCollisionsDeterministically() {
        assertNotEquals(ReminderDefinition.notificationId("https://a.test|1", 1), ReminderDefinition.notificationId("https://a.test|2", 1));
        assertTrue(ReminderDefinition.notificationId("https://a.test|1", 1) > 0);
        java.util.Set<Integer> used = new java.util.HashSet<>();
        assertEquals(100, ReminderDefinition.reserveId(100, used));
        assertEquals(101, ReminderDefinition.reserveId(100, used));
        assertEquals(Integer.MAX_VALUE, ReminderDefinition.reserveId(Integer.MAX_VALUE, used));
        assertEquals(1, ReminderDefinition.reserveId(Integer.MAX_VALUE, used));
    }
    @Test public void accountKeyRejectsTokensPathsAndUnsafeOrigins() {
        ReminderDefinition.validateAccount("https://example.test:443|12");
        assertThrows(IllegalArgumentException.class, () -> ReminderDefinition.validateAccount("http://example.test|12"));
        assertThrows(IllegalArgumentException.class, () -> ReminderDefinition.validateAccount("https://user:password@example.test|12"));
        assertThrows(IllegalArgumentException.class, () -> ReminderDefinition.validateAccount("https://example.test/path|12"));
        assertThrows(IllegalArgumentException.class, () -> ReminderDefinition.validateAccount("https://example.test?token=secret|12"));
    }
    @Test public void finalDateUsesCurrentDeviceLocalDayToRejectExpiredDelivery() {
        ReminderDefinition r = reminder(new String[]{"08:00"}, new Integer[]{4}, "2026-10-29", "2026-10-29");
        assertTrue(r.withinDateRange(instant("2026-10-29T20:59:59Z"), TimeZone.getTimeZone("Asia/Amman")));
        assertFalse(r.withinDateRange(instant("2026-10-29T21:00:00Z"), TimeZone.getTimeZone("Asia/Amman")));
        assertFalse(r.withinDateRange(instant("2026-10-28T20:59:59Z"), TimeZone.getTimeZone("Asia/Amman")));
    }
}
