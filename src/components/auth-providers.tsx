import {
  GithubLogoIcon,
  GoogleLogoIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react'

export const AUTH_PROVIDERS = [
  { id: 'github', name: 'GitHub', Icon: GithubLogoIcon },
  { id: 'google', name: 'Google', Icon: GoogleLogoIcon },
  { id: 'microsoft', name: 'Microsoft', Icon: SquaresFourIcon },
] as const

export type AuthProviderId = (typeof AUTH_PROVIDERS)[number]['id']
