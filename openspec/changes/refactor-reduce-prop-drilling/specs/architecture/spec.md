## MODIFIED Requirements

### Requirement: Component Data Access Pattern
Feature components SHALL access shared state via hooks directly rather than receiving it as props from parent components, unless the component is a reusable leaf node rendered in a list (e.g. list items receiving per-item data).

Parent components SHALL NOT import hooks or stores solely to extract data for a single child component.

Translation strings SHALL be computed within the component that renders them, not passed as pre-translated string props.

Local UI state (e.g. loading indicators, copy feedback, dirty tracking) SHALL be owned by the component that manages the interaction, not lifted to a parent.

#### Scenario: Self-contained feature component
- **WHEN** a feature component needs data from a Zustand store
- **THEN** it SHALL call the store hook directly
- **AND** the parent SHALL NOT act as an intermediary

#### Scenario: Leaf component in a list
- **WHEN** a component is rendered inside a `.map()` with per-item data
- **THEN** it MAY receive item-specific data as props
- **AND** shared state (e.g. translations, store data) SHALL still be accessed via hooks

#### Scenario: Translation ownership
- **WHEN** a component renders translated text
- **THEN** it SHALL call `useTranslations()` internally
- **AND** parent components SHALL NOT pass pre-translated strings as props
