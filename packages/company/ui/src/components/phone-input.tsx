"use client"

import { Button } from "@company/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@company/ui/components/command"
import { Input } from "@company/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@company/ui/components/popover"
import { cn } from "@company/ui/lib/utils"
import { ChevronDownIcon, GlobeIcon } from "lucide-react"
import { useState, type ComponentProps, type FocusEventHandler } from "react"
import PhoneNumberInput, {
  getCountryCallingCode,
  type Country,
} from "react-phone-number-input"

interface CountryOption {
  readonly divider?: boolean
  readonly label: string
  readonly value?: Country
}

interface CountrySelectProps {
  readonly "aria-describedby"?: string | undefined
  readonly "aria-invalid"?:
    | boolean
    | "false"
    | "grammar"
    | "spelling"
    | "true"
    | undefined
  readonly "aria-label"?: string | undefined
  readonly disabled?: boolean | undefined
  readonly onBlur?: FocusEventHandler<HTMLButtonElement> | undefined
  readonly onChange: (country?: Country) => void
  readonly onFocus?: FocusEventHandler<HTMLButtonElement> | undefined
  readonly options: ReadonlyArray<CountryOption>
  readonly readOnly?: boolean | undefined
  readonly value?: Country | undefined
}

function countryFlag(country: Country): string {
  return String.fromCodePoint(
    ...country
      .toUpperCase()
      .split("")
      .map((character) => character.charCodeAt(0) + 127_397)
  )
}

function CountrySelect({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": invalid,
  "aria-label": ariaLabel,
  disabled,
  onBlur,
  onChange,
  onFocus,
  options,
  readOnly,
  value,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleOptions = options.filter(
    (option) =>
      !option.divider &&
      (normalizedQuery === "" ||
        option.label.toLocaleLowerCase().includes(normalizedQuery) ||
        option.value?.toLocaleLowerCase().includes(normalizedQuery) === true ||
        (option.value === undefined
          ? "international"
          : `+${getCountryCallingCode(option.value)}`
        ).includes(normalizedQuery))
  )
  const selected = options.find((option) => option.value === value)

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery("")
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            data-slot="phone-country-trigger"
            aria-label={ariaLabel ?? "Country calling code"}
            aria-describedby={ariaDescribedBy}
            aria-invalid={invalid}
            disabled={disabled || readOnly}
            className="w-[5.25rem] shrink-0 justify-between border-r-0 px-2 font-normal"
            onBlur={onBlur}
            onFocus={onFocus}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {value === undefined ? (
            <GlobeIcon className="size-3.5 text-muted-foreground" />
          ) : (
            <span aria-hidden="true" className="text-sm leading-none">
              {countryFlag(value)}
            </span>
          )}
          <span className="truncate">{value ?? "Intl"}</span>
        </span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            aria-label="Search countries"
            placeholder="Search countries or calling codes…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No matching countries</CommandEmpty>
            {visibleOptions.map((option) => (
              <CommandItem
                key={option.value ?? "international"}
                value={option.value ?? "international"}
                data-checked={option.value === value}
                onSelect={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span aria-hidden="true" className="w-5 text-sm">
                  {option.value === undefined
                    ? "🌐"
                    : countryFlag(option.value)}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.value === undefined ? null : (
                  <span className="text-muted-foreground tabular-nums">
                    +{getCountryCallingCode(option.value)}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
      <span className="sr-only" aria-live="polite">
        {selected?.label}
      </span>
    </Popover>
  )
}

function PhoneTextInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn("border-l-0 focus-visible:z-10", className)}
      {...props}
    />
  )
}

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
  defaultCountry,
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
      className={cn("flex w-full", className)}
      containerComponentProps={{ "data-slot": "phone-input" }}
      countrySelectComponent={CountrySelect}
      countrySelectProps={{
        "aria-describedby": props["aria-describedby"],
        "aria-invalid": props["aria-invalid"],
      }}
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
