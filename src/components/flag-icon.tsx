"use client"

import React from "react"
import {
  US,
  GB,
  DE,
  FR,
  NG,
  ID,
  CA,
  IN,
  BR,
  MX,
  PH,
  TH,
  VN,
  EG,
  SA,
  AE,
  AU,
  JP,
  CN,
  KR,
  IT,
  ES,
  PL,
  NL,
  SE,
  CH,
  IE,
  PT,
  RO,
  BG,
  GR,
  TR,
  PK,
  BD,
  LK,
  NP,
  KH,
  LA,
  MM,
  MY,
  SG,
} from "country-flag-icons/react/3x2"

const FLAG_MAP: Record<string, React.ComponentType<{ title?: string; className?: string; style?: React.CSSProperties }>> = {
  us: US,
  gb: GB,
  uk: GB,
  de: DE,
  fr: FR,
  ng: NG,
  id: ID,
  ca: CA,
  in: IN,
  br: BR,
  mx: MX,
  ph: PH,
  th: TH,
  vn: VN,
  eg: EG,
  sa: SA,
  ae: AE,
  au: AU,
  jp: JP,
  cn: CN,
  kr: KR,
  it: IT,
  es: ES,
  pl: PL,
  nl: NL,
  se: SE,
  ch: CH,
  ie: IE,
  pt: PT,
  ro: RO,
  bg: BG,
  gr: GR,
  tr: TR,
  pk: PK,
  bd: BD,
  lk: LK,
  np: NP,
  kh: KH,
  la: LA,
  mm: MM,
  my: MY,
  sg: SG,
}

interface FlagIconProps {
  countryCode: string
  title?: string
  className?: string
  style?: React.CSSProperties
}

export function FlagIcon({ countryCode, title, className, style }: FlagIconProps) {
  const lower = countryCode.toLowerCase()
  const FlagComponent = FLAG_MAP[lower]
  if (!FlagComponent) return null
  return (
    <FlagComponent
      title={title}
      className={className}
      style={{
        width: 20,
        height: 14,
        display: "inline-block",
        verticalAlign: "middle",
        borderRadius: 2,
        ...style,
      }}
    />
  )
}
