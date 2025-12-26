// components/CleanTitleInput.jsx
import React, { useCallback } from 'react'
import { TextInput, Stack } from '@sanity/ui'
import { set, unset } from 'sanity'
import { cleanText } from '../utils/cleanText'

export const CleanTitleInput = (props) => {
  const { onChange, value = '', elementProps } = props

  const handleChange = useCallback(
    (event) => {
      const nextValue = event.currentTarget.value
      const cleanedValue = cleanText(nextValue)
      
      // Patch the value back to Sanity
      onChange(cleanedValue ? set(cleanedValue) : unset())
    },
    [onChange]
  )

  return (
    <Stack space={2}>
      <TextInput
        {...elementProps}
        onChange={handleChange}
        value={value}
      />
    </Stack>
  )
}