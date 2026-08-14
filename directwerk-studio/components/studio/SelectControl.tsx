'use client'

import {
    Children,
    isValidElement,
    type ChangeEvent,
    type ReactElement,
    type SelectHTMLAttributes,
} from 'react'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@directwerk/ui/components/select'

type OptionElement = ReactElement<
    SelectHTMLAttributes<HTMLOptionElement> & {value?: string | number}
>

interface SelectControlProps
    extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'defaultValue'> {
    value?: string | number
    defaultValue?: string | number
    onChange?: (event: ChangeEvent<HTMLSelectElement>) => void
}

/**
 * Adapts existing form-select behavior to the shared shadcn Select primitives.
 */
export default function SelectControl({
    children,
    className,
    defaultValue,
    disabled,
    id,
    name,
    onChange,
    required,
    value,
    ...props
}: SelectControlProps): React.JSX.Element {
    const options = Children.toArray(children).filter(
        (child): child is OptionElement => isValidElement(child) && child.type === 'option',
    )
    const rootValue = value === undefined ? undefined : String(value)
    const rootDefaultValue =
        defaultValue === undefined ? undefined : String(defaultValue)

    return (
        <Select
            defaultValue={rootDefaultValue}
            disabled={disabled}
            name={name}
            onValueChange={(nextValue) => {
                onChange?.({
                    target: {value: String(nextValue ?? '')},
                    currentTarget: {value: String(nextValue ?? '')},
                } as ChangeEvent<HTMLSelectElement>)
            }}
            required={required}
            value={rootValue}
        >
            <SelectTrigger
                aria-describedby={props['aria-describedby']}
                aria-label={props['aria-label']}
                className={className ?? 'w-full'}
                id={id}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((option, index) => (
                    <SelectItem
                        disabled={option.props.disabled}
                        key={`${String(option.props.value ?? '')}-${index}`}
                        value={String(option.props.value ?? '')}
                    >
                        {option.props.children}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
