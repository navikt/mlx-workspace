package no.nav.syfo.util

import java.time.LocalDate
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class DateUtilTest {

    @Test
    fun `daysBetweenDates should return zero when start and end are the same day`() {
        val date = LocalDate.of(2024, 1, 15)
        val result = DateUtil.daysBetweenDates(date, date)
        assertEquals(0, result)
    }

    @Test
    fun `daysBetweenDates should return positive value for forward date range`() {
        val start = LocalDate.of(2024, 1, 1)
        val end = LocalDate.of(2024, 1, 11)
        val result = DateUtil.daysBetweenDates(start, end)
        assertEquals(10, result)
    }

    @Test
    fun `daysBetweenDates should return negative value for reverse date range`() {
        val start = LocalDate.of(2024, 1, 11)
        val end = LocalDate.of(2024, 1, 1)
        val result = DateUtil.daysBetweenDates(start, end)
        assertEquals(-10, result)
    }

    @Test
    fun `daysBetweenDates should handle month boundaries correctly`() {
        val start = LocalDate.of(2024, 1, 31)
        val end = LocalDate.of(2024, 3, 1)
        val result = DateUtil.daysBetweenDates(start, end)
        assertEquals(30, result)
    }

    @Test
    fun `daysBetweenDates should handle leap year correctly`() {
        val start = LocalDate.of(2024, 2, 1)
        val end = LocalDate.of(2024, 3, 1)
        val result = DateUtil.daysBetweenDates(start, end)
        assertEquals(29, result)
    }

    @Test
    fun `daysBetweenDates should handle year boundaries correctly`() {
        val start = LocalDate.of(2023, 12, 31)
        val end = LocalDate.of(2024, 1, 1)
        val result = DateUtil.daysBetweenDates(start, end)
        assertEquals(1, result)
    }
}
