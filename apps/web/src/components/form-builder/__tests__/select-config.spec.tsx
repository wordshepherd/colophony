import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectConfig } from "../field-config/select-config";
import "../../../../test/setup";

describe("SelectConfig", () => {
  it("renders existing options", () => {
    const onChange = jest.fn();
    const config = {
      options: [
        { label: "Poetry", value: "poetry" },
        { label: "Fiction", value: "fiction" },
      ],
    };

    render(<SelectConfig config={config} onChange={onChange} />);

    expect(screen.getByDisplayValue("Poetry")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Fiction")).toBeInTheDocument();
    expect(screen.getByDisplayValue("poetry")).toBeInTheDocument();
    expect(screen.getByDisplayValue("fiction")).toBeInTheDocument();
  });

  it("adds a new option with auto-generated value", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const config = { options: [] as Array<{ label: string; value: string }> };

    render(<SelectConfig config={config} onChange={onChange} />);

    const input = screen.getByPlaceholderText("New option label");
    await user.type(input, "New Genre");
    await user.click(screen.getByText("Add"));

    expect(onChange).toHaveBeenCalledWith({
      options: [{ label: "New Genre", value: "new_genre" }],
    });
  });

  it("adds option on Enter key", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const config = { options: [] as Array<{ label: string; value: string }> };

    render(<SelectConfig config={config} onChange={onChange} />);

    const input = screen.getByPlaceholderText("New option label");
    await user.type(input, "Test Option{enter}");

    expect(onChange).toHaveBeenCalledWith({
      options: [{ label: "Test Option", value: "test_option" }],
    });
  });

  it("removes an option", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const config = {
      options: [
        { label: "Keep", value: "keep" },
        { label: "Remove", value: "remove" },
      ],
    };

    render(<SelectConfig config={config} onChange={onChange} />);

    const removeButtons = screen.getAllByLabelText("Remove option");
    await user.click(removeButtons[1]);

    expect(onChange).toHaveBeenCalledWith({
      options: [{ label: "Keep", value: "keep" }],
    });
  });

  it("updates an option label on change", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const config = {
      options: [{ label: "Original", value: "original" }],
    };

    render(<SelectConfig config={config} onChange={onChange} />);

    const labelInput = screen.getByDisplayValue("Original");
    // Type a character — onChange fires with the appended value
    await user.type(labelInput, "X");

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.options[0].label).toBe("OriginalX");
    expect(lastCall.options[0].value).toBe("original");
  });

  it("disables add button when input is empty", () => {
    const onChange = jest.fn();
    render(<SelectConfig config={{ options: [] }} onChange={onChange} />);

    expect(screen.getByText("Add")).toBeDisabled();
  });

  it("renders empty options list initially", () => {
    const onChange = jest.fn();
    render(<SelectConfig config={{}} onChange={onChange} />);

    expect(screen.getByText("Options")).toBeInTheDocument();
    expect(screen.queryByLabelText("Remove option")).not.toBeInTheDocument();
  });
});
