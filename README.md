# Orbital Antenna Lab

A Next.js learning dashboard for a first-pass 2.4 GHz rectangular microstrip patch. It includes live patch sizing, a React Three Fiber view with orbit/zoom controls, GLB/glTF import, and optional private design history in Supabase.

The contextual RF guide opens when you focus or adjust an input; it also opens from an `i` button or by clicking a calculated metric. It shows the current value, a before/after calculation as inputs change, and a response plot of estimated patch width and length. Warnings explain where this first-pass formula does not predict performance. The guide also includes feed matching and material-property concepts.

## Material and infill learning controls

Choose PLA, wood-filled PLA, ABS, PETG, ASA, nylon, RF filament, or a custom material. The included dielectric presets are individual printed samples measured at 2.4 GHz, with links to the research sources: [PLA infill samples](https://onlinelibrary.wiley.com/doi/full/10.1002/mop.29324) and [wood-filled PLA](https://ietresearch.onlinelibrary.wiley.com/doi/10.1049/el.2016.2505). They are not generic values for every filament. Uncharacterized materials keep editable εr and loss-tangent assumptions and show a warning.

Change the infill pattern and polymer volume fraction to see a schematic cutaway update. If those settings no longer match a published sample, the app keeps the last dielectric numbers and warns that it does not infer new RF properties from slicer settings. The cutaway shows the copper patch and feed, printed dielectric and infill, ground plane, and a coax-feed illustration. Substrate thickness is exaggerated vertically so the internal construction is visible.

## Run locally

1. Install Node.js 20.9 or newer.
2. Run `npm install` and `npm run dev`.
3. Open `http://localhost:3000`.

Supabase history is optional. Copy `.env.example` to `.env.local`, fill in the project URL and anon key, run `supabase/schema.sql` in the Supabase SQL editor, and allow email OTP sign-in in Supabase Auth. No service-role key is used in the browser.

## Load a Fusion model

Use the Model file control to load a `.glb` or `.gltf` file. For a glTF that references external texture or binary files, package it as GLB or keep its referenced files accessible alongside the model. The built-in parametric preview updates with calculated patch dimensions.

## Deploy

Import the repository into Vercel, set the two `NEXT_PUBLIC_SUPABASE_*` environment variables if history is desired, then deploy. This version is a geometry and transmission-line estimate, not a full-wave electromagnetic solver or flight-qualified design.

