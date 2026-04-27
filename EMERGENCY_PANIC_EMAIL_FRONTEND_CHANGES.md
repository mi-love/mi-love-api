# Emergency Panic Flow Update

## Summary
This change updates the panic flow in two ways:

- The panic API should now receive the emergency number in `phone_number`.
- Panic notifications should no longer be sent through WhatsApp.
- Panic notifications are now sent by email to the authenticated user's registered email address.

This document explains the backend changes already made and the exact frontend changes required.

## Backend Changes Implemented

### 1. Panic request payload updated
File:
`src/modules/emergencies/emergency.dto.ts`

The panic DTO now accepts:

```ts
export class PanicDto {
	phone_number?: string;
	emergency_contact?: string;
	latitude: number;
	longitude: number;
	reason?: string;
}
```

Notes:

- `phone_number` is now the preferred field for the emergency number.
- `emergency_contact` is still accepted temporarily for backward compatibility.

### 2. Panic delivery channel changed from WhatsApp to email
File:
`src/modules/emergencies/emergency.service.ts`

The panic flow now does this:

1. Reads the emergency number from the request body.
2. Falls back to older fields when necessary.
3. Sends a panic email instead of a WhatsApp panic message.
4. Sends the email to the logged-in user's registered account email.

Emergency number resolution order:

1. `body.phone_number`
2. `body.emergency_contact`
3. `user.emergency_contact`

The panic email includes:

- User full name
- Registered email
- Emergency number used
- Panic reason
- Home address
- Latitude
- Longitude
- Google Maps link
- Trigger time

### 3. Mail service wired into emergency module
File:
`src/modules/emergencies/emergency.module.ts`

`MailService` was added to the module providers so panic emails can be sent from the emergency service.

## Updated Panic API Contract

### Endpoint

```http
POST /emergencies/panic
```

### Authentication

Bearer token required.

### Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Preferred Request Body

```json
{
	"phone_number": "+2348012345678",
	"latitude": 6.5244,
	"longitude": 3.3792,
	"reason": "Medical emergency"
}
```

### Backward-Compatible Body

This older field is still accepted for now:

```json
{
	"emergency_contact": "+2348012345678",
	"latitude": 6.5244,
	"longitude": 3.3792,
	"reason": "Medical emergency"
}
```

### Success Response

```json
{
	"message": "Panic Alert sent successfully"
}
```

### Non-Delivery Response

When the user has no registered email:

```json
{
	"message": "Panic Alert not sent due to missing registered email"
}
```

### Error Response Example

```json
{
	"message": "Failed to send panic alert email",
	"provider": "email"
}
```

Expected HTTP status on delivery failure:

```http
502 Bad Gateway
```

## Frontend Changes Required

### 1. Update panic request payload

Change the frontend panic request payload to send `phone_number` instead of `emergency_contact`.

New preferred payload shape:

```ts
type PanicRequest = {
	phone_number?: string;
	latitude: number;
	longitude: number;
	reason?: string;
	emergency_contact?: string;
};
```

Important:

- `emergency_contact` should only remain temporarily for backward compatibility.
- New frontend work should standardize on `phone_number`.

### 2. Update panic trigger UI copy

Any text that says the alert is sent through WhatsApp must be changed.

Replace WhatsApp-specific wording with email-specific wording.

Examples:

- Old: `Panic message sent via WhatsApp`
- New: `Panic alert email sent to your registered email`

More examples:

- Old: `Sending WhatsApp panic alert...`
- New: `Sending panic alert email...`

- Old: `WhatsApp panic alert failed`
- New: `Panic alert email failed`

### 3. Update success and failure handling

Frontend should now interpret panic responses like this:

#### Success

- Show success toast/banner using backend `message`
- Use email-specific copy in the UI

#### Missing registered email

If backend returns:

```json
{
	"message": "Panic Alert not sent due to missing registered email"
}
```

Frontend should:

- Show an error or warning state
- Inform the user that a registered email is required
- Provide a CTA to update account/profile email

Suggested user-facing copy:

`We could not send your panic alert because your account does not have a registered email. Please update your email and try again.`

#### Email provider failure

If backend returns provider `email`, frontend should:

- Show delivery failure state
- Allow retry
- Optionally show contact support CTA if your product already has one

### 4. Keep location and reason handling unchanged

Frontend should continue sending:

- `latitude`
- `longitude`
- optional `reason`

No change is required to the map/location capture logic except ensuring the payload key for the emergency number is now `phone_number`.

### 5. Update analytics or event tracking

If the frontend has analytics around panic alerts, rename any channel-specific events that mention WhatsApp.

Examples:

- `panic_whatsapp_sent` -> `panic_email_sent`
- `panic_whatsapp_failed` -> `panic_email_failed`

If possible, use neutral names instead:

- `panic_alert_sent`
- `panic_alert_failed`

With a metadata field like:

```ts
{
	channel: 'email'
}
```

## Recommended Frontend Implementation Notes

### Form/state changes

If your panic screen currently stores the emergency number under `emergency_contact`, either:

1. Rename the state field to `phone_number`, or
2. Keep local UI naming unchanged but map it to `phone_number` before sending the API request.

Example mapping:

```ts
const payload = {
	phone_number: form.emergencyContact,
	latitude,
	longitude,
	reason,
};
```

### Safer compatibility rollout

If you want a safe transition during rollout, you can temporarily send both:

```ts
const payload = {
	phone_number: form.emergencyContact,
	emergency_contact: form.emergencyContact,
	latitude,
	longitude,
	reason,
};
```

This is optional because the backend already supports fallback handling.

## QA Checklist

### Case 1: Panic with new payload

Send:

```json
{
	"phone_number": "+2348012345678",
	"latitude": 6.5244,
	"longitude": 3.3792,
	"reason": "Medical emergency"
}
```

Expected:

- Success response returned
- Frontend shows email-based success copy

### Case 2: Panic with old compatibility field

Send:

```json
{
	"emergency_contact": "+2348012345678",
	"latitude": 6.5244,
	"longitude": 3.3792,
	"reason": "Medical emergency"
}
```

Expected:

- Request still works
- Useful during migration period

### Case 3: Panic without request emergency number

Send:

```json
{
	"latitude": 6.5244,
	"longitude": 3.3792,
	"reason": "Medical emergency"
}
```

Expected:

- Backend falls back to stored `user.emergency_contact` if available

### Case 4: User without registered email

Expected:

- Backend returns non-delivery message
- Frontend prompts user to add/update email

### Case 5: Email delivery failure

Expected:

- Backend returns provider `email`
- Frontend shows retry/error handling state

## Suggested Frontend Rollout Plan

1. Update panic API request payload to use `phone_number`.
2. Update all WhatsApp-related panic UI copy to email wording.
3. Add fallback UI for missing registered email.
4. Update analytics event names if applicable.
5. Test both the new payload and temporary compatibility flow.
6. Later remove `emergency_contact` from the frontend once all clients have migrated.

## Final Note

The backend currently supports both `phone_number` and `emergency_contact` for a smoother migration, but the frontend should move fully to `phone_number` as the canonical panic request field.
