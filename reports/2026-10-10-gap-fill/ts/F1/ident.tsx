import KopierbarTekst from "../../../../../kopierbarTekst";

interface IdentProps {
  ident: string;
  erDnummer?: boolean;
}

function Ident({ ident, erDnummer = false }: IdentProps) {
  return <KopierbarTekst hovertekst={erDnummer ? "Kopier D-nummer" : "Kopier fødselsnummer"}>{ident}</KopierbarTekst>;
}

export default Ident;
