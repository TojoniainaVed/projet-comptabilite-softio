import { cn } from '@/lib/utils'

const LOGOS = {
  /** Logo complet : cube et mot « Softio ». */
  full: { src: '/logo-softio.png', width: 990, height: 364 },
  /** Cube seul, pour les petits espaces. */
  icon: { src: '/logo-softio-icon.png', width: 287, height: 364 },
} as const

interface LogoProps {
  variant?: keyof typeof LOGOS
  /** Fixez la hauteur (par exemple `h-8`) : la largeur suit les proportions. */
  className?: string
}

/** Logo Softio. Ses couleurs sont fixes : placez-le sur un fond clair. */
export function Logo({ variant = 'full', className }: LogoProps) {
  const { src, width, height } = LOGOS[variant]
  return (
    <img src={src} width={width} height={height} alt="Softio" className={cn('w-auto', className)} />
  )
}
