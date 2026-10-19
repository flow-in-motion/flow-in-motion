import { Link } from "react-router-dom";

import {
  LegalPageLayout,
  LegalSection,
} from "@/components/legal/legal-page-layout";

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="19 October 2026">
      <LegalSection title="1. About these terms">
        <p>
          These Terms of Service ("Terms") apply to your use of Research in
          Motion ("the Service", "we", "us"), a project and task tracking tool
          for research teams. By creating an account or using the Service, you
          agree to these Terms and to our{" "}
          <Link to="/privacy" className="font-medium underline underline-offset-2">
            Privacy Policy
          </Link>
          . If you do not agree, please do not use the Service.
        </p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <p>
          You sign in through our authentication provider, Supabase Auth; we
          never store your password. You must give accurate account details,
          keep your sign-in details secure, and tell us if you think someone
          has accessed your account without permission. You are responsible
          for activity under your account.
        </p>
      </LegalSection>

      <LegalSection title="3. Workspaces and collaborators">
        <p>
          Content you create belongs to a workspace. Workspace owners can add
          collaborators, remove members and delete the workspace at any time.
          Deleting a workspace permanently deletes every project, paper, task
          and note in it. If you add another person as a collaborator, you are
          responsible for having a good reason to share their name, email
          address and affiliation with the Service.
        </p>
      </LegalSection>

      <LegalSection title="4. Your content">
        <p>
          You keep ownership of the content you add to the Service. You give us
          permission to store, process and display it only as needed to run the
          Service for you and the people you share it with.
        </p>
        <p>
          You are responsible for making sure you have the right to store and
          share your content, and for not adding content that is unlawful,
          infringing, or sensitive data the Service is not designed to hold
          (for example, classified research data or health information about
          other people).
        </p>
      </LegalSection>

      <LegalSection title="5. Usage data and monitoring">
        <p>
          To run and improve the Service, we automatically collect information
          about how you use it, such as the sections you visit, key actions you
          take, session information and error reports. By using the Service,
          you agree to this collection.
        </p>
        <p>
          If you are a member of a workspace, the workspace owner can see a
          usage summary that includes your name, email address and activity in
          that workspace (such as sessions, page visits, items added and when
          you were last active). The{" "}
          <Link to="/privacy" className="font-medium underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          explains exactly what is collected, who can see it and how long it
          is kept.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>When using the Service, you agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>break any law or anyone else's rights;</li>
          <li>
            try to access accounts, workspaces or data you are not authorised to
            access;
          </li>
          <li>
            interfere with, overload or try to break the security of the
            Service;
          </li>
          <li>
            use automated tools to scrape or bulk-download the Service, except
            through features we provide; or
          </li>
          <li>upload malicious code or use the Service to send spam.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Feedback">
        <p>
          If you send us feedback or suggestions, including screenshots
          attached through the feedback button, we may use them to improve the
          Service without any obligation to you.
        </p>
      </LegalSection>

      <LegalSection title="8. Deletion and retention">
        <p>
          Archived projects and papers are kept for 14 days so they can be
          restored, then permanently deleted automatically. After that, they
          cannot be recovered. You can delete your account at any time from
          Settings.
        </p>
      </LegalSection>

      <LegalSection title="9. Availability and changes to the Service">
        <p>
          We are continually improving the Service, so features may change,
          be added or be removed. Features marked as upcoming or in progress
          are not yet available and may change before release. We do not
          guarantee that the Service will always be available or free of
          errors, and we recommend keeping your own copies of important work.
        </p>
      </LegalSection>

      <LegalSection title="10. Suspension and termination">
        <p>
          You can stop using the Service at any time and delete your account
          from Settings. We may suspend or close accounts that break these
          Terms or the law, or where needed to protect the Service or other
          users.
        </p>
      </LegalSection>

      <LegalSection title="11. Disclaimers and limitation of liability">
        <p>
          The Service is provided "as is" and "as available". To the fullest
          extent permitted by law, we make no warranties about the Service and
          are not liable for any indirect, incidental or consequential loss,
          or loss of data, arising from your use of it. Nothing in these Terms
          excludes rights you have under the Australian Consumer Law that
          cannot be excluded.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes to these terms">
        <p>
          We may update these Terms from time to time. When we do, we will
          update the "Last updated" date above and, for significant changes,
          let you know in the app. If you keep using the Service after an
          update, you accept the revised Terms.
        </p>
      </LegalSection>

      <LegalSection title="13. Governing law">
        <p>
          These Terms are governed by the laws of New South Wales, Australia.
        </p>
      </LegalSection>

      <LegalSection title="14. Contact us">
        <p>
          Questions about these Terms can be sent to us at{" "}
          <a href="mailto:jepsendenise01@gmail.com" className="font-medium underline underline-offset-2">
            jepsendenise01@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
