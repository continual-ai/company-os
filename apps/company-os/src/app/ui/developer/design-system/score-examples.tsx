import { Label } from "@company/ui/label"
import { Score, ScoreInput } from "@company/ui/score"
import { useState } from "react"

import {
  Example,
  type ComponentSection,
} from "#/app/ui/developer/design-system/example.tsx"

export const scorePage: ComponentSection = {
  id: "score",
  title: "Score",
  description:
    "A numeric score with five compact segments. Color summarizes low, medium, and high values; the exact number is always visible. Use schema.score() for model fields.",
  component: ScoreExamples,
  usage:
    'import { Score, ScoreInput } from "@company/ui/score"\n\n<Score value={92} />\n<ScoreInput label="Score" value={draft} onValueChange={setDraft} />\n\n// In a module model:\nscore: schema.score({ label: "Score", nullable: true })',
}

function ScoreExamples() {
  const [value, setValue] = useState("78")
  const [rating, setRating] = useState("3")
  return (
    <>
      <Example title="At a glance" source="@company/ui/score">
        <div className="max-w-md divide-y rounded-lg border px-4">
          {[
            { label: "High", value: 99 },
            { label: "Medium", value: 78 },
            { label: "Low", value: 49 },
            { label: "Zero", value: 0 },
            { label: "Unscored", value: null },
          ].map(({ label, value: exampleValue }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <span>{label}</span>
              <Score value={exampleValue} label={label} />
            </div>
          ))}
        </div>
      </Example>
      <Example title="Adjust a score" source="@company/ui/score">
        <div className="max-w-sm space-y-3">
          <Label htmlFor="example-score">Score</Label>
          <ScoreInput
            id="example-score"
            value={value}
            onValueChange={setValue}
          />
          <p className="text-xs text-muted-foreground">
            Drag or use arrow keys for quick changes. Type an exact value, or
            clear it to leave the record unscored.
          </p>
        </div>
      </Example>
      <Example title="Custom range" source="@company/ui/score">
        <div className="max-w-sm space-y-3">
          <Label htmlFor="example-rating">Review score</Label>
          <ScoreInput
            id="example-rating"
            label="Review score"
            min={1}
            max={5}
            value={rating}
            onValueChange={setRating}
          />
        </div>
      </Example>
    </>
  )
}
