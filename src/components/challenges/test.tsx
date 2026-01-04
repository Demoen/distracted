import { memo, useEffect } from "react";
import { IconFlask } from "@tabler/icons-react";
import type { ChallengeComponentProps } from "@/lib/challenges/ui";
import { defineChallengeUi } from "@/lib/challenges/ui";
import { checkboxGroupOption, radioOption } from "@/lib/challenges/options";

export const TestChallenge = memo(
  ({
    settings,
    onComplete,
  }: ChallengeComponentProps<{
    textOption: string;
    multilineTextOption: string;
    numberOption: number;
    sliderOption: number;
    checkboxOption: boolean;
    selectOption: string;
    radioOption: string;
    checkboxGroupOption: string[];
  }>) => {
    // This is a test challenge - just complete immediately
    // The purpose is to test all option types
    useEffect(() => {
      const timer = setTimeout(() => {
        onComplete();
      }, 100);
      return () => clearTimeout(timer);
    }, [onComplete]);

    return (
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-center text-primary">
          <IconFlask className="size-6" />
        </div>
        <div className="space-y-2">
          <p className="font-medium">Test Challenge</p>
          <p className="text-sm text-muted-foreground">
            This is a kitchen sink of all challenge options.
          </p>
          <div className="mt-4 p-4 bg-muted/30 rounded-lg text-left text-xs space-y-1 font-mono">
            <div>
              <strong>Text:</strong> {settings.textOption}
            </div>
            <div>
              <strong>Multiline:</strong> {settings.multilineTextOption}
            </div>
            <div>
              <strong>Number:</strong> {settings.numberOption}
            </div>
            <div>
              <strong>Slider:</strong> {settings.sliderOption}
            </div>
            <div>
              <strong>Checkbox:</strong> {settings.checkboxOption ? "true" : "false"}
            </div>
            <div>
              <strong>Select:</strong> {settings.selectOption}
            </div>
            <div>
              <strong>Radio:</strong> {settings.radioOption}
            </div>
            <div>
              <strong>Checkbox Group:</strong> {settings.checkboxGroupOption.join(", ") || "none"}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

TestChallenge.displayName = "TestChallenge";

export const testChallenge = defineChallengeUi({
  label: "Test (Kitchen Sink)",
  icon: <IconFlask className="size-5" />,
  description: "Test challenge with all option types",
  title: "Test Challenge",
  options: {
    textOption: {
      type: "text",
      label: "Text Option",
      default: "default text",
      placeholder: "Enter some text",
      description: "A simple text input option",
    },
    multilineTextOption: {
      type: "text",
      label: "Multiline Text Option",
      default: "Line 1\nLine 2\nLine 3",
      placeholder: "Enter multiline text",
      multiline: true,
      description: "A multiline text input option",
    },
    numberOption: {
      type: "number",
      label: "Number Option",
      default: 42,
      min: 0,
      max: 100,
      step: 1,
      description: "A number input option",
    },
    sliderOption: {
      type: "slider",
      label: "Slider Option",
      default: 50,
      min: 0,
      max: 100,
      step: 5,
      marks: [0, 25, 50, 75, 100] as const,
      description: "A slider option",
    },
    checkboxOption: {
      type: "checkbox",
      label: "Checkbox Option",
      default: false,
      description: "A checkbox option",
    },
    selectOption: {
      type: "select",
      label: "Select Option",
      default: "option1",
      options: [
        { label: "Option 1", value: "option1" },
        { label: "Option 2", value: "option2" },
        { label: "Option 3", value: "option3" },
      ] as const,
      description: "A select dropdown option",
    },
    radioOption: radioOption({
      label: "Radio Option",
      default: "choice2",
      options: [
        { label: "Choice A", value: "choice1" },
        { label: "Choice B", value: "choice2" },
        { label: "Choice C", value: "choice3" },
      ] as const,
      description: "A radio button group option",
    }),
    checkboxGroupOption: checkboxGroupOption({
      label: "Checkbox Group Option",
      default: ["value10", "value30"],
      options: [
        { label: "Value 10", value: "value10" },
        { label: "Value 20", value: "value20" },
        { label: "Value 30", value: "value30" },
        { label: "Value 40", value: "value40" },
      ] as const,
      description: "A checkbox group option",
    }),
  },
  render: (props) => <TestChallenge {...props} />,
});
