import {
  LegalPageLayout,
  LegalSection,
} from "@/components/legal/legal-page-layout";

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated="Draft — date to be set on publication"
    >
      <LegalSection title="1. Overview">
        <p>
          This policy explains what information Research in Motion ("the
          Service") collects, how it's used, and where it's stored. It covers
          the Service as it exists today — not features that are still planned
          or in progress.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Account details from Supabase Auth: name, email address, and a
            unique account identifier.
          </li>
          <li>
            Profile details you add yourself: job title, institution,
            department, phone number, and research interests.
          </li>
          <li>
            Content you create: projects, modules, tasks, daily notes,
            conference submissions, pipeline stages, and comments or
            descriptions attached to them.
          </li>
          <li>
            Workspace membership and collaboration data: who owns or
            collaborates on a project or module, and pending email invitations.
          </li>
          <li>
            Basic product-usage events: which pages you visit and a small number
            of key actions (for example, creating a project or completing a
            task), each tied to your account and workspace and timestamped.
          </li>
          <li>
            Error diagnostics: if the interface encounters an unexpected error
            while you're signed in, we record what broke (an error message and a
            technical stack trace) and which page you were on, so it can be
            fixed.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use your information">
        <p>
          Your information is used to operate the Service: authenticating you,
          showing you the projects and tasks you have access to, and letting you
          collaborate with others in your workspace. Usage events are used only
          to show the workspace owner an aggregate summary of how the workspace
          uses the Service (for example, a count of pages visited or actions
          taken) — they are not shared outside the Service, not used for
          advertising, and not sold. We do not currently use any third-party
          analytics or advertising services.
        </p>
      </LegalSection>

      <LegalSection title="4. Where your data is stored">
        <p>
          Account authentication and application data are hosted by Supabase in
          its Sydney region. The application frontend, API, email delivery,
          logs, and related operational services are hosted on Amazon Web
          Services in Sydney.
        </p>
      </LegalSection>

      <LegalSection title="5. Data retention">
        <p>
          Archiving a project or module keeps it recoverable for 14 days, after
          which it is permanently and automatically deleted. Account and profile
          data is retained for as long as your account is active.
        </p>
      </LegalSection>

      <LegalSection title="6. Local storage and cookies">
        <p>
          The Service stores your Supabase authentication session and a small
          number of display preferences in your browser. The session is used to
          keep you signed in and authorize API requests. Display preferences
          such as your color theme and text size are used to remember how you
          like the interface set up.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights and choices">
        <p>
          You can review and update your profile details at any time from
          Settings. To request a copy of your data or its deletion beyond what
          workspace tools already provide, contact the team maintaining this
          deployment of the Service.
        </p>
      </LegalSection>

      <LegalSection title="8. Children's privacy">
        <p>
          The Service is intended for research and academic use by adults and is
          not directed at children.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to this policy">
        <p>
          If what we collect or how we use it changes — for example, if a
          third-party analytics or advertising service is introduced — this page
          will be updated and the "Last updated" date above will change
          accordingly.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          Questions about this policy can be directed to the workspace owner or
          the team maintaining this deployment of the Service.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
