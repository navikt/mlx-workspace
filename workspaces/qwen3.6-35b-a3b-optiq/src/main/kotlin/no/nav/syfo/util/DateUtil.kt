package no.nav.syfo.util

import java.time.LocalDate

object DateUtil {
    fun dagerMellomDatoer(start: LocalDate, end: LocalDate): Long {
        return java.time.temporal.ChronoUnit.DAYS.between(start, end)
    }
}
