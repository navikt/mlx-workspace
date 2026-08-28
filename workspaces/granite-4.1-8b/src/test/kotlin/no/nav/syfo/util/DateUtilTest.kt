package no.nav.syfo.util

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.LocalDate

internal class DateUtilTest {
    @Test
    fun `dagerMellomDatoer returns zero days when start and end are the same`() {
        val startDate = LocalDate.of(2023, 1, 1)
        val endDate = LocalDate.of(2023, 1, 1)
        assertEquals(0, DateUtil.dagerMellomDatoer(startDate, endDate))
    }

    @Test
    fun `dagerMellomDatoer returns positive days`() {
        val startDate = LocalDate.of(2023, 1, 1)
        val endDate = LocalDate.of(2023, 1, 5)
        assertEquals(4, DateUtil.dagerMellomDatoer(startDate, endDate))
    }
}
