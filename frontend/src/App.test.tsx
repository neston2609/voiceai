import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders login screen first", () => {
    render(<App />);
    expect(screen.getByText("VoiceFlowAI")).toBeInTheDocument();
  });
});
