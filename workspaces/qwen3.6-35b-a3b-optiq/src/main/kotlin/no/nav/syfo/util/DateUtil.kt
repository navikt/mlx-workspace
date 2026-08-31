package no.nav.syfo.util

import java.time.LocalDate

object DateUtil {
    /**
     * Returns the number of days between [start] and [end].
     */
    fun daysBetweenDates(start: LocalDate, end: LocalDate): Long {
        return java.time.temporal.ChronoUnit.DAYS.between(start, end)
    }
}
