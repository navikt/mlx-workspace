package no.nav.syfo.infrastructure.database.bit

import no.nav.syfo.domain.bit.OppfolgingstilfelleBit

data class POppfolgingstilfelleBit(
    val id: Long,
    val kilde: String?
)

fun POppfolgingstilfelleBit.toOppfolgingstilfelleBit(): OppfolgingstilfelleBit {
    return OppfolgingstilfelleBit(
        id = this.id,
        kilde = this.kilde
    )
}
