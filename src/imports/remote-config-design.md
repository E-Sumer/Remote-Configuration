Design a full enterprise-grade Remote Configuration (Feature Flags) module for Netmera.

Use Netmera’s visual language:
Primary Blue #2563EB
Success Green #22C55E
Sidebar Dark #111827
Background #F9FAFB
Card White #FFFFFF
Border #E5E7EB
Primary Text #111827
Secondary Text #6B7280
Danger #EF4444
Warning #F59E0B
Font: Inter
Radius: 8px
8px spacing system
Minimal, enterprise, clean

========================================
ROUTING STRUCTURE
========================================

/remote_configuration (Listing Page)
/create_remote_configuration
/edit_remote_configuration_configurationid:{config_id}
/view_remote_configuration_configurationid:{config_id}

========================================
1. LISTING PAGE (/remote_configuration)
========================================

Page Title: Remote Configuration
Primary CTA (Top Right): + Create Configuration
Search bar
Filters:
- Status (DRAFT, LIVE, STOPPED, COMPLETED)
- Type (String, Integer, Boolean, JSON)
- Environment
- Has Variants (Yes/No)

Table Columns:
- Status (colored badge)
- Configuration Name
- Version
- Type
- Variants Count
- Rollout %
- Target Segment
- Last Edited
- Created By
- Actions (kebab menu)

Statuses:
DRAFT (gray badge)
LIVE (green badge)
STOPPED (orange badge)
COMPLETED (blue badge)

Action Menu Options:
- View
- Edit
- Start
- Stop
- Complete
- Duplicate
- Delete

Behavior Rules:
- Duplicate creates new config with name prefixed: "Copy - {Original Name}"
- Start is only enabled when status = DRAFT or STOPPED
- Stop only visible when status = LIVE
- Complete only visible when status = LIVE
- Edit disabled if LIVE (must stop first)
- Delete disabled if LIVE

Empty State:
Headline: Control Your Application Without Releasing New Versions
CTA: Create First Configuration

========================================
2. CREATE PAGE (/create_remote_configuration)
========================================

Multi-step structured form.

Header:
Create Remote Configuration
Version: v1.0 (Draft auto created)

Step 1 — Basic Information
Fields:
- Configuration Name
- Key (auto slug editable)
- Description
- Environment (Prod/Test)

Step 2 — Type Definition
Selectable cards:
Boolean
String
Integer
JSON

Step 3 — Variations & Keys

Core Structure:
Each configuration can have multiple Keys.
Each Key can have multiple Variants (for A/B testing).

UI Structure:
Accordion per Key:
Key Name
Data Type
Default Value

Button: + Add New Key

Inside each Key:
Section: Variants

Variant A (Control) — required
Variant B
Variant C (optional)

Each Variant contains:
- Value editor (dynamic by type)
- Traffic allocation %
- Delete variant button (except Control)

Traffic distribution must sum to 100%.
Provide:
Auto Even Split button

For JSON:
Provide JSON editor with validation + "Valid JSON" indicator.

========================================
4. FULL ROLLOUT FUNCTIONALITY
========================================

Inside configuration screen:
Add toggle:
Enable Gradual Rollout

Rollout Slider:
0% to 100%

Button:
Full Rollout

If clicked:
Set rollout to 100%
Disable traffic split
Mark experiment logic as inactive

Full Rollout visually shows:
Green indicator bar

========================================
5. START / STOP / VERSIONING RULES
========================================

When user clicks Start:
Status becomes LIVE
Version locked

If user clicks Edit on LIVE config:
Show modal:
"This configuration is currently LIVE.
To edit, you must stop the current version.
Stopping will preserve reporting and create a new editable version."

Buttons:
Cancel
Stop & Create New Version

Behavior:
- Current version moves to STOPPED
- New version created v1.1 (Draft)
- All values copied
- Reporting tied to v1.0
- Editing allowed in v1.1

Complete:
Moves config to COMPLETED
Locks permanently
No editing allowed

========================================
6. VIEW PAGE (/view_remote_configuration_configurationid:{config_id})
========================================

Two Tabs:

TAB 1: Configuration
- Key structure
- Variants
- Rollout %
- Target segment
- Version history timeline

TAB 2: Report

Report Content:
Top Cards:
- Total Users Exposed
- Conversion Rate per Variant
- Lift %
- Confidence %
- Revenue (if applicable)

Charts:
- Variant Comparison Bar Chart
- Trend Over Time
- Exposure Distribution

Below:
Variant Table:
- Variant
- Users
- Conversions
- Lift
- Confidence

Buttons:
Declare Winner
Full Rollout
Stop Experiment

========================================
7. EDIT PAGE (/edit_remote_configuration_configurationid:{config_id})
========================================

Editable only if status != LIVE

Editable:
- Keys
- Variants
- Traffic
- Description

Not Editable:
- Previous version reporting

========================================
8. ADDITIONAL UX IMPROVEMENTS
========================================

- Add Version History dropdown
- Add Audit Log section
- Add dependency warning if used in campaign/journey
- Show where configuration key is referenced
- Sticky user bucketing toggle
- Show “Estimated impacted users” based on segment
- Add Save as Draft autosave every 10 seconds
- Add Confirm before Delete modal
- Add keyboard shortcut: Cmd+S Save Draft
- Visual indicator when traffic != 100%
- Tooltip explaining statistical confidence
- Disable publish if JSON invalid
- Badge if config used in live campaign

========================================
VISUAL STYLE
========================================

Minimal.
Table dominant layout.
Right-side contextual detail panel optional.
No clutter.
Marketing-first wording.
Clear lifecycle state indicators.