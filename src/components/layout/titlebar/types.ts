export interface TitlebarProps {
  title?: string;
  showTitle?: boolean;
  isAIOpen?: boolean;
  isAIProcessing?: boolean;
  isAIDisabled?: boolean;
  onToggleAI?: () => void;
  onOpenSettings?: () => void;
  onOpenShortcutsHelp?: () => void;
}
