import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "../../../../test/setup";
import { FormStepper, type FormStepperStep } from "../form-stepper";

const steps: FormStepperStep[] = [
  { id: "s1", title: "Details" },
  { id: "s2", title: "Review" },
  { id: "s3", title: "Submit" },
];

describe("FormStepper", () => {
  it("renders step circles with correct numbers", () => {
    render(
      <FormStepper
        steps={steps}
        currentStepIndex={0}
        completedStepIndices={new Set()}
      />,
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("highlights current step with aria-current", () => {
    render(
      <FormStepper
        steps={steps}
        currentStepIndex={1}
        completedStepIndices={new Set([0])}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[1]).toHaveAttribute("aria-current", "step");
    expect(buttons[0]).not.toHaveAttribute("aria-current");
    expect(buttons[2]).not.toHaveAttribute("aria-current");
  });

  it("calls onStepClick for completed step click", () => {
    const onStepClick = jest.fn();
    render(
      <FormStepper
        steps={steps}
        currentStepIndex={1}
        completedStepIndices={new Set([0])}
        onStepClick={onStepClick}
      />,
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // completed step
    expect(onStepClick).toHaveBeenCalledWith(0);
  });

  it("does not call onStepClick for future step click", () => {
    const onStepClick = jest.fn();
    render(
      <FormStepper
        steps={steps}
        currentStepIndex={0}
        completedStepIndices={new Set()}
        onStepClick={onStepClick}
      />,
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[2]); // future step
    expect(onStepClick).not.toHaveBeenCalled();
  });

  it("renders page titles below circles", () => {
    render(
      <FormStepper
        steps={steps}
        currentStepIndex={0}
        completedStepIndices={new Set()}
      />,
    );

    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Submit")).toBeInTheDocument();
  });

  it("applies disabled state correctly", () => {
    const onStepClick = jest.fn();
    render(
      <FormStepper
        steps={steps}
        currentStepIndex={1}
        completedStepIndices={new Set([0])}
        onStepClick={onStepClick}
        disabled
      />,
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // normally clickable, but disabled
    expect(onStepClick).not.toHaveBeenCalled();
  });
});
