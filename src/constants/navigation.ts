import {
  BarChart3,
  Bookmark,
  FileUp,
  Gauge,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Settings,
  Timer,
  Users,
} from 'lucide-react';

export interface NavigationLink {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface NavigationSection {
  title: string;
  links: NavigationLink[];
}

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    title: 'Dia a dia',
    links: [
      { path: '/', label: 'Painel', icon: LayoutDashboard },
      { path: '/worklogs', label: 'Worklogs', icon: ListChecks },
      { path: '/importar', label: 'Importar', icon: FileUp },
    ],
  },
  {
    title: 'Relatórios',
    links: [
      { path: '/relatorios/horas', label: 'Horas da equipe', icon: BarChart3 },
      { path: '/relatorios/sprint', label: 'Sprint', icon: Timer },
      { path: '/relatorios/estimativas', label: 'Estimado × real', icon: Gauge },
    ],
  },
  {
    title: 'Organização',
    links: [
      { path: '/favoritos', label: 'Favoritos', icon: Bookmark },
      { path: '/grupos', label: 'Grupos', icon: Users },
    ],
  },
];

export const SETTINGS_LINK: NavigationLink = { path: '/configuracoes', label: 'Configurações', icon: Settings };
