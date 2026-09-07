"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

interface LinkButtonProps extends React.ComponentProps<typeof Button> {
  href: string
}

export function LinkButton({ href, children, ...props }: LinkButtonProps) {
  return (
    <Button render={<Link href={href} />} {...props}>
      {children}
    </Button>
  )
}