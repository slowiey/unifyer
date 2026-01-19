# Unifyer - Project Structure

## 📁 Folder Organization

```
unifyer/
├── pages/                          # Feature-based pages
│   ├── auth/                       # Authentication pages
│   │   └── LoginPage.tsx          # Login & signup interface
│   │
│   └── studio/                     # Main studio application
│       └── StudioPage.tsx         # Academic management dashboard
│
├── shared/                         # Shared resources across features
│   ├── components/                 # Reusable UI components
│   │   ├── AIChat.tsx             # AI assistant chat interface
│   │   └── Shared.tsx             # Small shared components (Badge, ProgressBar)
│   │
│   ├── contexts/                   # React contexts
│   │   └── AuthContext.tsx        # Authentication state management
│   │
│   └── services/                   # External service integrations
│       └── geminiService.ts       # Google Gemini AI API integration
│
├── App.tsx                         # Main app router (auth-based routing)
├── index.tsx                       # Application entry point
├── types.ts                        # TypeScript type definitions
├── vite-env.d.ts                  # Vite environment type definitions
└── ...config files

```

## 🎯 Design Principles

### Feature-based Organization
- **`pages/`** - Organized by feature/domain (auth, studio, etc.)
- Each feature has its own folder with related pages
- Easy to add new features without cluttering the root

### Shared Resources
- **`shared/`** - Contains truly reusable code across features
- Components, contexts, and services used by multiple features
- Clear separation between feature-specific and shared code

### Scalability
This structure supports growth:
- Add new features: `pages/analytics/`, `pages/settings/`, etc.
- Add feature-specific components: `pages/studio/components/`
- Add shared utilities: `shared/utils/`, `shared/hooks/`

## 🚀 Future Additions

When the project grows, consider adding:

```
pages/
├── landing/           # Marketing landing page
├── settings/          # User settings & preferences
├── analytics/         # Academic analytics & insights
└── collaboration/     # Team/group features

shared/
├── hooks/             # Custom React hooks
├── utils/             # Utility functions
├── constants/         # App-wide constants
└── types/             # Shared TypeScript types
```

## 📝 Import Conventions

**From pages:**
```typescript
import { useAuth } from '../../shared/contexts/AuthContext';
import AIChat from '../../shared/components/AIChat';
```

**From App.tsx:**
```typescript
import { useAuth } from './shared/contexts/AuthContext';
import LoginPage from './pages/auth/LoginPage';
```

## ✨ Benefits

1. **Clear boundaries** - Easy to understand where code belongs
2. **Maintainable** - Changes to one feature don't affect others
3. **Scalable** - Simple to add new features or pages
4. **Team-friendly** - Different developers can work on different features
5. **Testable** - Feature isolation makes testing easier
