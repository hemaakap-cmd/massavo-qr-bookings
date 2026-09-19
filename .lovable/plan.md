# Fix Home Visit hours in therapist editing

## What will change
- Add a dedicated **Home Visit Working Hours** section inside **Edit Therapist**.
- Show each assigned city with its existing weekly days and hours.
- Allow adding, editing, enabling/disabling, and deleting a city-specific Home Visit shift without leaving the therapist page.
- Keep Gym and Hotel schedules unchanged.

## Technical details
- Reuse the existing city-scoped `therapist_weekly_schedules.city_id` model and schedule mutations.
- Only show Home Visit rows where both Gym and Hotel are empty.
- Refresh client availability after every schedule change so customers only see days configured for their selected city.
- Verify the edit flow in the live preview, then run the complete test suite.
