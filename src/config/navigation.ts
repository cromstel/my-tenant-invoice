export interface NavigationLink {
  href: string;
  label: string;
}

export const navigationLinks: readonly NavigationLink[] = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/security', label: 'Security' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];
