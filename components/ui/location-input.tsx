'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Loader2, X } from 'lucide-react'
import { LocationAnswer, ThemeConfig } from '@/lib/database.types'

interface LocationInputProps {
  value: LocationAnswer | null
  onChange: (value: LocationAnswer | null) => void
  theme: ThemeConfig
  placeholder?: string
}

interface MapboxFeature {
  id: string
  place_name: string
  center: [number, number] // [lng, lat]
  context?: Array<{
    id: string
    text: string
    short_code?: string
  }>
  properties?: {
    short_code?: string
  }
}

interface MapboxResponse {
  features: MapboxFeature[]
}

export function LocationInput({ value, onChange, theme, placeholder }: LocationInputProps) {
  const [inputValue, setInputValue] = useState(value?.place_name || '')
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  // Debounced search
  const searchLocations = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !mapboxToken) {
      setSuggestions([])
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        new URLSearchParams({
          access_token: mapboxToken,
          types: 'address,place,postcode,locality,neighborhood',
          country: 'us', // Limit to US for energy services
          limit: '5',
          autocomplete: 'true',
        })
      )

      if (!response.ok) throw new Error('Geocoding failed')

      const data: MapboxResponse = await response.json()
      setSuggestions(data.features || [])
      setShowSuggestions(true)
      setHighlightedIndex(-1)
    } catch (error) {
      console.error('Location search error:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [mapboxToken])

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // Clear previous selection if user is typing
    if (value) {
      onChange(null)
    }

    // Debounce API calls
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      searchLocations(newValue)
    }, 300)
  }

  // Extract location components from Mapbox feature
  const parseLocationFromFeature = (feature: MapboxFeature): LocationAnswer => {
    let city: string | undefined
    let state: string | undefined
    let country: string | undefined
    let postcode: string | undefined

    // Parse context for location components
    feature.context?.forEach((ctx) => {
      if (ctx.id.startsWith('place.')) {
        city = ctx.text
      } else if (ctx.id.startsWith('region.')) {
        state = ctx.text
      } else if (ctx.id.startsWith('country.')) {
        country = ctx.text
      } else if (ctx.id.startsWith('postcode.')) {
        postcode = ctx.text
      } else if (ctx.id.startsWith('locality.')) {
        // Use locality as city if no place found
        if (!city) city = ctx.text
      }
    })

    // If this is a place itself, use it as the city
    if (feature.id.startsWith('place.')) {
      city = feature.place_name.split(',')[0]
    }

    return {
      place_name: feature.place_name,
      city,
      state,
      country,
      postcode,
      longitude: feature.center[0],
      latitude: feature.center[1],
    }
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (feature: MapboxFeature) => {
    const location = parseLocationFromFeature(feature)
    setInputValue(feature.place_name)
    onChange(location)
    setSuggestions([])
    setShowSuggestions(false)
    setHighlightedIndex(-1)
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[highlightedIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setHighlightedIndex(-1)
        break
    }
  }

  // Clear selection
  const handleClear = () => {
    setInputValue('')
    onChange(null)
    setSuggestions([])
    inputRef.current?.focus()
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const inputStyles = {
    borderColor: isFocused ? theme.primaryColor : `${theme.textColor}30`,
    color: theme.textColor,
    backgroundColor: 'transparent',
  }

  // Check if Mapbox token is configured
  if (!mapboxToken) {
    return (
      <div
        className="p-4 rounded-xl border-2 border-dashed"
        style={{ borderColor: '#EF4444', color: '#EF4444' }}
      >
        <p className="text-sm">
          Location input requires NEXT_PUBLIC_MAPBOX_TOKEN to be configured.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <MapPin
          className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 opacity-50"
          style={{ color: theme.textColor }}
        />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            setIsFocused(true)
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Start typing your location...'}
          className="w-full text-xl md:text-2xl h-auto py-3 pl-9 pr-10 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:opacity-40 outline-none"
          style={inputStyles}
          autoFocus
          autoComplete="off"
        />
        {isLoading && (
          <Loader2
            className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin"
            style={{ color: theme.primaryColor }}
          />
        )}
        {value && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 rounded-full hover:opacity-70 transition-opacity"
            style={{ color: theme.textColor }}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-2 py-2 rounded-xl border-2 shadow-lg overflow-hidden"
          style={{
            backgroundColor: theme.backgroundColor,
            borderColor: `${theme.textColor}20`,
          }}
        >
          {suggestions.map((feature, index) => (
            <button
              key={feature.id}
              type="button"
              onClick={() => handleSelectSuggestion(feature)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className="w-full px-4 py-3 text-left flex items-start gap-3 transition-colors"
              style={{
                backgroundColor:
                  index === highlightedIndex
                    ? `${theme.primaryColor}15`
                    : 'transparent',
                color: theme.textColor,
              }}
            >
              <MapPin
                className="w-5 h-5 mt-0.5 shrink-0 opacity-50"
                style={{ color: theme.primaryColor }}
              />
              <span className="text-base">{feature.place_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Selected location indicator */}
      {value && (
        <div
          className="mt-3 flex items-center gap-2 text-sm"
          style={{ color: theme.primaryColor }}
        >
          <MapPin className="w-4 h-4" />
          <span>Location selected</span>
        </div>
      )}
    </div>
  )
}
