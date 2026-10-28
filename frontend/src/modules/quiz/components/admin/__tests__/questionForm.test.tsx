/**
 * The form of a question of the quiz.
 *
 * The servant writes the question, the points and the options, and
 * marks the correct one. The rules of the form are the rules of the
 * quiz: two to six options, one correct answer, from 1 to 100 points.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { QuestionForm } from "@/modules/quiz/components/admin/QuestionForm";
import type { QuestionFormValues } from "@/modules/quiz/components/admin/questionSchema";

function Harness({
  onReady,
}: {
  onReady?: (form: ReturnType<typeof useForm<QuestionFormValues>>) => void;
}) {
  const form = useForm<QuestionFormValues>({
    defaultValues: {
      question: "ما هو الكتاب؟",
      points: 10,
      options: [
        { optionText: "إنجيل متى", isCorrect: true },
        { optionText: "إنجيل لوقا", isCorrect: false },
      ],
    },
  });
  onReady?.(form);
  return (
    <FormProvider {...form}>
      <QuestionForm form={form} />
    </FormProvider>
  );
}

describe("the form of a question", () => {
  it("shows the question, the points and the options", () => {
    render(<Harness />);

    expect(screen.getByDisplayValue("ما هو الكتاب؟")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
    expect(screen.getByDisplayValue("إنجيل متى")).toBeInTheDocument();
    expect(screen.getByDisplayValue("إنجيل لوقا")).toBeInTheDocument();
  });

  it("adds an option, and never more than six", () => {
    render(<Harness />);

    const add = screen.getByRole("button", { name: /إضافة|add/i });
    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(add);
    }

    // Six options at the most: the letters go from A to F.
    expect(screen.getByText("F")).toBeInTheDocument();
    expect(add).toBeDisabled();
  });

  it("never removes the last two options", () => {
    render(<Harness />);

    const removeButtons = screen.getAllByRole("button", {
      name: /إزالة|حذف|remove/i,
    });
    expect(removeButtons).toHaveLength(2);
    for (const button of removeButtons) {
      expect(button).toBeDisabled();
    }
  });

  it("removes an option when there are more than two", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /إضافة|add/i }));
    const removeButtons = screen.getAllByRole("button", {
      name: /إزالة|حذف|remove/i,
    });
    expect(removeButtons).toHaveLength(3);
    expect(removeButtons[0]).toBeEnabled();

    fireEvent.click(removeButtons[0]);
    expect(
      screen.getAllByRole("button", { name: /إزالة|حذف|remove/i }),
    ).toHaveLength(2);
  });

  it("counts the characters of the question", () => {
    render(<Harness />);
    // The counter is split over two nodes.
    const counter = document.querySelector("span.absolute");
    expect(counter?.textContent?.replace(/\s+/g, " ")).toBe("13 / 500");
  });

  it("raises and lowers the points, and never below one", () => {
    render(<Harness />);

    // The two buttons of the points sit next to the number.
    const points = screen.getByDisplayValue("10").parentElement;
    const buttons = points?.querySelectorAll("button") ?? [];
    expect(buttons).toHaveLength(2);
    const [minus, add] = buttons;

    fireEvent.click(add);
    expect(screen.getByDisplayValue("11")).toBeInTheDocument();

    fireEvent.click(minus);
    fireEvent.click(minus);
    fireEvent.click(minus);
    fireEvent.click(minus);
    fireEvent.click(minus);
    fireEvent.click(minus);
    fireEvent.click(minus);
    fireEvent.click(minus);
    fireEvent.click(minus);
    fireEvent.click(minus);
    expect(screen.getByDisplayValue("1")).toBeInTheDocument();
  });
});
