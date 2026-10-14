'use client'

import {
    Children,
    isValidElement,
    type ChangeEvent,
    type ReactElement,
    type ReactNode,
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

/**
 * Issue #418: previously extended SelectHTMLAttributes while honouring only a handful of them,
 * so a caller passing e.g. aria-invalid or onBlur had it silently dropped. The type now lists
 * exactly what the component supports; anything else is a compile error rather than a no-op.
 */
interface SelectControlProps {
    children: ReactNode
    className?: string
    value?: string | number
    defaultValue?: string | number
    disabled?: boolean
    id?: string
    name?: string
    required?: boolean
    onChange?: (event: ChangeEvent<HTMLSelectElement>) => void
    'aria-describedby'?: string
    'aria-label'?: string
}


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
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
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
                aria-describedby={ariaDescribedBy}
                aria-label={ariaLabel}
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
