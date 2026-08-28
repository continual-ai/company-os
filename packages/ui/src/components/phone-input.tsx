"use client"

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@company/ui/components/command"
import { Input } from "@company/ui/components/input"
import {
  InputGroup,
  InputGroupButton,
} from "@company/ui/components/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@company/ui/components/popover"
import { cn } from "@company/ui/lib/utils"
import { GlobeIcon } from "lucide-react"
import {
  forwardRef,
  useState,
  type ComponentProps,
  type FocusEventHandler,
} from "react"
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
          <InputGroupButton
            type="button"
            variant="ghost"
            size="icon-sm"
            data-slot="input-group-control"
            aria-label={
              selected === undefined
                ? (ariaLabel ?? "Phone number country")
                : `${ariaLabel ?? "Phone number country"}: ${selected.label}`
            }
            aria-describedby={ariaDescribedBy}
            aria-invalid={invalid}
            disabled={disabled || readOnly}
            className="h-full w-9 shrink-0 border-0 px-0 focus-visible:ring-0"
            onBlur={onBlur}
            onFocus={onFocus}
          />
        }
      >
        {value === undefined ? (
          <GlobeIcon className="size-3.5 text-muted-foreground" />
        ) : (
          <span aria-hidden="true" className="text-sm leading-none">
            {countryFlag(value)}
          </span>
        )}
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

const PhoneTextInput = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  function PhoneTextInput({ className, ...props }, ref) {
    return (
      <Input
        ref={ref}
        data-slot="input-group-control"
        className={cn(
          "flex-1 border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
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
