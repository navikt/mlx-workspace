import { Endringstype, TekstblokkStatus } from "../../services/modules/tekstblokker";
import { labelForEndringstype, labelForStatus, labelForType } from "./labels";

describe("labels", () => {
  it("labelForType", () => {
    expect(labelForType("BREVMAL")).toBe("brevmal");
    expect(labelForType("TEKSTBLOKK")).toBe("tekstblokk");
  });

  it("labelForEndringstype", () => {
    expect(labelForEndringstype("OPPRETTET")).toBe("Opprettet");
    expect(labelForEndringstype("ENDRET")).toBe("Endret");
    expect(labelForEndringstype("SLETTET")).toBe("Slettet");
    expect(labelForEndringstype("UKJENT" as Endringstype)).toBe("UKJENT");
  });

  it("labelForStatus", () => {
    expect(labelForStatus("UTKAST")).toBe("Utkast");
    expect(labelForStatus("PUBLISERT")).toBe("Publisert");
    expect(labelForStatus("UKJENT" as TekstblokkStatus)).toBe("UKJENT");
  });
});
