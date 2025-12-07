# Juvana - Tanzania's Data Science Platform

## Overview

Juvana is a competitive data science platform designed for Tanzania's data science community. It enables users to participate in machine learning competitions, share datasets, collaborate in private/community playgrounds, and build their skills through real-world challenges. The platform features a comprehensive competition system with leaderboards, team formation, submission scoring, discussion forums, and integrated dataset management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, built on Vite for fast development and optimized production builds.

**UI Component System**: The application uses shadcn/ui components built on Radix UI primitives, providing accessible, customizable components. All UI components follow a consistent design system defined in CSS variables (HSL color space) with support for dark mode via next-themes.

**Routing**: Client-side routing implemented with React Router v6, supporting navigation between landing, competitions, datasets, playgrounds, dashboard, and various detail pages.

**State Management**: React Context API for authentication state (AuthContext) and TanStack Query (React Query) for server state management and caching.

**Styling**: Tailwind CSS with custom design tokens including gradient utilities, shadow definitions, and a purple/magenta primary color scheme. The design system emphasizes gradients and elegant shadows for a modern aesthetic.

### Backend Architecture

**Firebase Services**: The application uses Firebase as its primary backend infrastructure:
- **Authentication**: Firebase Auth with Google Sign-In provider for user authentication
- **Database**: Firestore for storing competitions, datasets, playgrounds, submissions, teams, discussions, and user data
- **Storage**: Firebase Storage for file uploads (datasets, submission files, competition data)
- **Cloud Functions**: Firebase Cloud Functions (Node.js 18) for server-side operations including:
  - Auto-assignment of admin roles to specific email addresses
  - User role document creation on user signup
  - Submission scoring and validation (planned/partial implementation)

**Data Model**:
- Collections: `users`, `user_roles`, `competitions`, `datasets`, `playgrounds`, `submissions`, `teams`, `team_invites`, `discussions`, `notification_preferences`
- Subcollections: `competitions/{id}/submissions`, `competitions/{id}/leaderboard`, `datasets/{id}/versions`, `datasets/{id}/files`
- Role-based access control with admin/organizer roles

### Competition System

**Competition Types**:
1. **Public Competitions**: Open competitions with public leaderboards and dataset access
2. **Playgrounds**: Private or community-based competitions with invite codes, suitable for educational institutions or organizations

**Submission Pipeline**:
1. Users upload CSV files with predictions
2. Client-side validation checks file format, required columns (id, target/prediction), and row count
3. Files are uploaded to Firebase Storage
4. Scoring is performed (client-side currently, with backend scoring utilities prepared)
5. Scores are recorded in submissions collection and leaderboard is updated
6. Daily submission limits are enforced per competition

**Evaluation**: Support for multiple metrics including accuracy, RMSE, MAE, F1, and AUC. Competitions can specify scoring method, ID column, target column, and ground truth data location.

**Team System**: Users can form teams for competitions, invite members via email, and submit as a team. Team scores are aggregated on the leaderboard.

### Dataset Management

**Dataset Features**:
- Upload multiple files (CSV, JSON, etc.) with metadata (name, subtitle, description, category, tags, license)
- Version control system for datasets with changelog support
- File explorer with download tracking and view counts
- Data preview and exploration tools including column analysis, sorting, filtering
- Integration with competitions (datasets can be linked to competitions)
- Size limits: 50MB for uncompressed files

**Storage Strategy**: Files are stored in Firebase Storage under `datasets/{datasetId}/v{version}/{filename}` paths. Metadata is stored in Firestore with references to storage URLs.

### Discussion System

**Features**: Threaded discussions for competitions with support for nested replies, real-time updates via Firestore listeners, and user avatars/names.

**Implementation**: Uses Firestore subcollections for organizing discussions and replies with serverTimestamp for ordering.

### External Dependencies

**Core Dependencies**:
- **Firebase SDK** (v12.5.0): Authentication, Firestore, Storage, Cloud Functions
- **React** (v18.3.1) with React Router for SPA functionality
- **TanStack Query** (v5.83.0): Server state management and caching
- **shadcn/ui components**: Built on Radix UI primitives for accessible components
- **Tailwind CSS**: Utility-first styling with custom design system
- **Lucide React**: Icon library
- **date-fns**: Date formatting and manipulation
- **papaparse**: CSV parsing on the client side

**Development Tools**:
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety (configured with relaxed settings: strict mode off)
- **ESLint**: Code linting with React-specific rules

**Hosting**: Firebase Hosting configured to serve the built application with SPA routing support (all routes redirect to index.html).

**Third-party Integrations**:
- Google OAuth for authentication
- Google Analytics (Firebase Analytics) for usage tracking
- Lovable platform integration (component tagger in development mode)

### Design Patterns

**Component Organization**: Components are organized by feature (competitions, datasets, playgrounds, notebooks) and shared UI components. Reusable logic is extracted into custom hooks (useAuth, useAdminRole, useIsMobile, useToast).

**Authentication Flow**: Users sign in with Google OAuth, user documents are created/updated in Firestore on authentication, admin roles are automatically assigned via Cloud Functions for specific email addresses.

**Real-time Updates**: Firestore listeners (onSnapshot) are used for real-time leaderboards, discussions, and team updates.

**File Upload Strategy**: Direct uploads to Firebase Storage with progress tracking, followed by metadata storage in Firestore. URLs are generated and stored for later access.

**Scoring Architecture**: Hybrid approach with client-side validation and scoring utilities, with prepared backend Cloud Functions for secure server-side scoring (partially implemented).