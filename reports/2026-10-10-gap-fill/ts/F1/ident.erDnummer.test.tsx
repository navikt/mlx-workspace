import { fireEvent, render, screen } from "@testing-library/react";
import Ident from "./ident";

// Hidden check for F1: copied next to ident.tsx at verification time, never shown to the model.
describe("Ident hovertekst", () => {
  it("viser fødselsnummer som standard", () => {
    render(<Ident ident="11111111111" />);
    fireEvent.mouseOver(screen.getByText(/11111111111/));
    expect(screen.getByText("Kopier fødselsnummer")).toBeInTheDocument();
  });

  it("viser D-nummer når erDnummer er satt", () => {
    render(<Ident ident="41111111111" erDnummer />);
    fireEvent.mouseOver(screen.getByText(/41111111111/));
    expect(screen.getByText("Kopier D-nummer")).toBeInTheDocument();
    expect(screen.queryByText("Kopier fødselsnummer")).not.toBeInTheDocument();
  });
});
