import {
  LegalPageLayout,
  LegalSection,
} from "@/components/legal/legal-page-layout";

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="19 October 2026">
      <LegalSection title="1. Overview">
        <p>
          This Privacy Policy explains what information Research in Motion
          ("the Service", "we", "us") collects when you use it, how we use that
          information, who can see it, and the choices you have. It describes
          the Service as it works today, not features that are still planned.
        </p>
        <p>
          By creating an account or using the Service, you acknowledge that
          your information will be handled as described in this policy. We aim
          to handle personal information in line with the Australian Privacy
          Principles under the Privacy Act 1988 (Cth).
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>We collect the following kinds of information:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account information.</strong> Your name, email address and
            a unique account identifier, provided when you sign up through our
            authentication provider (Supabase Auth). We never see or store your
            password.
          </li>
          <li>
            <strong>Profile information.</strong> Details you choose to add,
            such as job title, institution, department, phone number and
            research interests.
          </li>
          <li>
            <strong>Content you create.</strong> Projects, papers, tasks, notes,
            conference submissions, funding records, pipeline stages and any
            descriptions or comments you add to them, along with a history of
            changes to papers (for example, when a paper moves to a new stage
            and who moved it).
          </li>
          <li>
            <strong>Workspace and collaboration information.</strong> Which
            workspaces you belong to, who owns or collaborates on each item, and
            the names, email addresses and affiliations of collaborators you or
            others add.
          </li>
          <li>
            <strong>Usage information.</strong> While you are signed in, we
            automatically record how you use the Service. This includes:
            <ul className="mt-2 list-[circle] space-y-1 pl-5">
              <li>
                which sections of the app you visit (for example "Papers" or
                "Tasks"; we record the section, not the specific record you
                opened);
              </li>
              <li>
                key actions, such as creating a project, paper, task, note or
                conference entry, or completing a task;
              </li>
              <li>
                a random session identifier, stored in your browser, so visits
                can be grouped into sessions (a session ends after 30 minutes
                of inactivity);
              </li>
              <li>
                the date and time of each event, and the account and workspace
                it belongs to.
              </li>
            </ul>
          </li>
          <li>
            <strong>Error reports.</strong> If the app runs into an unexpected
            error while you are signed in, we record the error message, a
            technical stack trace and the page you were on, so we can fix it.
          </li>
          <li>
            <strong>Feedback you send.</strong> If you use the feedback button,
            we collect your message, your rating and, unless you remove it, a
            screenshot of the screen you were viewing. Screenshots may show any
            information that was visible on your screen at the time.
          </li>
        </ul>
        <p>
          We do not use third-party analytics, advertising or tracking tools,
          and we do not use advertising cookies.
        </p>
      </LegalSection>

      <LegalSection title="3. How we use your information">
        <p>We use the information we collect to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>provide, operate and secure the Service, including signing you in;</li>
          <li>
            show you the workspaces, projects and other items you have access
            to, and let you collaborate with others;
          </li>
          <li>
            give workspace owners a usage summary of their workspace (see
            section 4);
          </li>
          <li>
            understand which features are used, so we can improve the Service
            and decide what to build next;
          </li>
          <li>diagnose and fix errors, and respond to feedback; and</li>
          <li>comply with our legal obligations.</li>
        </ul>
        <p>
          We do not sell your personal information, and we do not use it for
          advertising.
        </p>
      </LegalSection>

      <LegalSection title="4. Who can see your information">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>People in your workspace</strong> can see content shared
            with them and the names of people they collaborate with.
          </li>
          <li>
            <strong>Workspace owners</strong> can see a Usage page for their
            workspace. As well as overall totals, it lists each member by name
            and email address, with their number of sessions and page visits,
            how many projects, papers, tasks and notes they have added, and when
            they were last active, for periods of up to 90 days.
          </li>
          <li>
            <strong>The team operating the Service</strong> can access stored
            data, including usage events, error reports and feedback, where
            needed to run, support and improve the Service.
          </li>
          <li>
            <strong>Service providers</strong> who host the Service for us (see
            section 5). They process data on our behalf and are not permitted
            to use it for their own purposes.
          </li>
          <li>
            <strong>Others where required by law</strong>, for example in
            response to a valid legal request.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Where your information is stored">
        <p>
          Authentication and application data are hosted by Supabase in its
          Sydney region. The application, API, email delivery (including
          feedback emails), logs and related services are hosted on Amazon Web
          Services in Sydney, Australia.
        </p>
      </LegalSection>

      <LegalSection title="6. How long we keep information">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Account, profile and usage information is kept while your account
            is active.
          </li>
          <li>
            Archived projects and papers are kept for 14 days so they can be
            restored, then permanently deleted automatically.
          </li>
          <li>
            When you delete your account, your account, profile and usage
            information is deleted. When a workspace is deleted, its content
            and usage information is deleted.
          </li>
          <li>
            Feedback is kept for as long as it is useful for improving the
            Service.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Cookies and local storage">
        <p>
          The Service does not use advertising or third-party cookies. It
          stores a small amount of information in your browser to work
          properly:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>your sign-in session, to keep you signed in;</li>
          <li>
            display preferences, such as theme, text size, dashboard layout and
            table columns;
          </li>
          <li>
            list searches and filters for your current browser session; and
          </li>
          <li>the random usage session identifier described in section 2.</li>
        </ul>
        <p>
          You can clear this information through your browser settings, but
          you will be signed out and your preferences will reset.
        </p>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>
          We use reasonable technical and organisational measures to protect
          your information, including encrypted connections and access
          controls. No online service can be completely secure, so we cannot
          guarantee the security of information you send to us.
        </p>
      </LegalSection>

      <LegalSection title="9. Your rights and choices">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            You can view and update your profile details at any time in
            Settings.
          </li>
          <li>
            You can permanently delete your account and its data from Settings.
          </li>
          <li>
            You can ask for a copy of your personal information, or ask us to
            correct it, by contacting us (see section 12).
          </li>
          <li>
            Usage information is needed to operate and improve the Service, so
            it cannot currently be turned off for individual accounts. If you
            do not want it collected, you can stop using the Service and delete
            your account.
          </li>
        </ul>
        <p>
          If you are unhappy with how we have handled your information, please
          contact us first. If we do not resolve your concern, you can complain
          to the Office of the Australian Information Commissioner (OAIC).
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>
          The Service is intended for research and academic use by adults. It
          is not directed at children, and we do not knowingly collect
          information from anyone under 18.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          We may update this policy from time to time, for example if we change
          what we collect or start using a new service provider. When we do, we
          will update the "Last updated" date above and, for significant
          changes, let you know in the app.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact us">
        <p>
          Questions or requests about this policy or your information can be
          sent to us at{" "}
          <a href="mailto:jepsendenise01@gmail.com" className="font-medium underline underline-offset-2">
            jepsendenise01@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
