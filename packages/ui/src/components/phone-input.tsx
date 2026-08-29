"use client"

import { Input } from "@company/ui/components/input"
import { InputGroup } from "@company/ui/components/input-group"
import { cn } from "@company/ui/lib/utils"
import { GlobeIcon } from "lucide-react"
import { forwardRef, type ComponentProps, type FocusEventHandler } from "react"
import PhoneNumberInput, { type Country } from "react-phone-number-input"

function countryFlag(country: Country): string {
  return String.fromCodePoint(
    ...country
      .toUpperCase()
      .split("")
      .map((character) => character.charCodeAt(0) + 127_397)
  )
}

function CountryIndicator({ value }: { readonly value?: Country | undefined }) {
  return (
    <span
      aria-hidden="true"
      data-slot="phone-country-indicator"
      className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-9 items-center justify-center border-r border-input bg-muted/40 text-sm leading-none text-muted-foreground"
    >
      {value === undefined ? (
        <GlobeIcon className="size-3.5" />
      ) : (
        countryFlag(value)
      )}
    </span>
  )
}

const PhoneTextInput = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  function PhoneTextInput({ className, ...props }, ref) {
    return (
      <Input
        ref={ref}
        data-slot="input-group-control"
        className={cn(
          "flex-1 border-0 bg-transparent pl-11 shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
          className
        )}
        {...props}
      />
    )
  }
)

export interface PhoneInputProps extends Omit<
  ComponentProps<"input">,
  "defaultValue" | "onBlur" | "onChange" | "onFocus" | "ref" | "value"
> {
  readonly defaultCountry?: Country | undefined
  readonly onBlur?: FocusEventHandler<HTMLElement> | undefined
  readonly onFocus?: FocusEventHandler<HTMLElement> | undefined
  readonly onValueChange: (value: string) => void
  readonly value: string
}

/** International phone input that emits a canonical E.164 value. */
export function PhoneInput({
  className,
  defaultCountry = "US",
  onBlur,
  onFocus,
  onValueChange,
  value,
  ...props
}: PhoneInputProps) {
  return (
    // @ts-expect-error -- upstream optional DOM props omit `undefined`, which is
    // incompatible with exactOptionalPropertyTypes despite matching runtime behavior.
    <PhoneNumberInput
      {...props}
      className={cn(className)}
      containerComponent={InputGroup}
      countrySelectComponent={CountryIndicator}
      defaultCountry={defaultCountry}
      inputComponent={PhoneTextInput}
      smartCaret={false}
      value={value}
      {...(onBlur === undefined ? {} : { onBlur })}
      {...(onFocus === undefined ? {} : { onFocus })}
      onChange={(nextValue) => onValueChange(nextValue ?? "")}
    />
  )
}
