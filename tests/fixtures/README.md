# Test Fixtures

This directory contains reusable test data for unit, integration, and E2E tests. Fixtures are organized by category and loaded through the `loader.ts` utility for type-safe access.

## Structure

- **documents/**: Document fixtures in various formats (Markdown, text)
- **translations/**: Translation sample pairs for different language combinations
- **users/**: User profile fixtures with different roles and states
- **projects/**: Project configuration and metadata fixtures
- **loader.ts**: Type-safe fixture loader utility

## Usage

Import fixtures using the loader utility:

```typescript
import {
  loadDocument,
  loadTranslation,
  loadUser,
  loadProject,
  getDocumentPath,
} from '../fixtures/loader';

// Load document content
const content = loadDocument('short-story.md');

// Load translation data
const translation = loadTranslation('english-spanish');

// Load user data
const user = loadUser('regular-user');

// Load project data
const project = loadProject('sample-project');

// Get document path for file upload
const path = getDocumentPath('technical-doc.md');
```

## Benefits

- **Consistency**: Same test data across all test levels
- **Maintainability**: Update fixtures in one place, changes apply everywhere
- **Realism**: Fixtures represent real-world scenarios
- **Type Safety**: Loader provides TypeScript types for IDE support
- **Extensibility**: Easy to add new fixtures without changing test code

## Adding New Fixtures

1. Create a new file in the appropriate subdirectory
2. Follow the naming convention: `descriptive-name.{md,json}`
3. Include comprehensive metadata and realistic data
4. Update the loader utility if adding a new fixture type
5. Document the fixture purpose in comments

## Fixture Categories

### Documents

- `short-story.md`: Narrative fiction with 450 words and 3 chapters
- `technical-doc.md`: API documentation with code samples and technical terminology
- `poetry.md`: Collection of poems with various styles and formatting
- `multilingual.md`: Mixed language content covering 7 languages and special characters

### Translations

- `english-spanish.json`: General domain, intermediate difficulty
- `english-french.json`: Technical domain, advanced difficulty
- `english-arabic.json`: RTL text, narrative style with cultural considerations

### Users

- `regular-user.json`: Standard user with active projects and preferences
- `admin-user.json`: Admin user with full system capabilities
- `new-user.json`: New user with onboarding flow and no projects

### Projects

- `sample-project.json`: Realistic project with sections, progress, and Git configuration
