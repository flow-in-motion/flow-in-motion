import {
  LegalPageLayout,
  LegalSection,
} from "@/components/legal/legal-page-layout";

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated="Draft — date to be set on publication"
    >
      <LegalSection title="1. About this service">
        <p>
          Research in Motion ("the Service") is a research project- and
          task-tracking tool for research teams: projects, modules, tasks, daily
          notes, conference submissions and pipeline stages, organised within a
          shared workspace.
        </p>
      </LegalSection>

      <LegalSection title="2. Accounts">
        <p>
          You sign in through Supabase Auth. We do not store your password in
          the application — authentication is handled by Supabase. You are
          responsible for keeping your sign-in credentials secure and for
          activity that happens under your account.
        </p>
      </LegalSection>

      <LegalSection title="3. Workspaces and collaborators">
        <p>
          Content you create belongs to a workspace. Workspace owners can invite
          collaborators by email using a secure, single-use acceptance link, and
          can remove members or delete the workspace at any time. Removing a
          workspace deletes every project, module, task and note inside it.
        </p>
      </LegalSection>

      <LegalSection title="4. Your content">
        <p>
          You retain ownership of the project, task, module and note content you
          enter. You're responsible for making sure you have the right to store
          and share anything you upload or type into the Service, and for not
          entering unlawful, infringing, or sensitive content that this Service
          isn't designed to hold (for example, classified research data or
          special-category personal data about third parties).
        </p>
      </LegalSection>

      <LegalSection title="5. Deletion and retention">
        <p>
          Archiving a project or module does not delete it immediately —
          archived items are kept for 14 days so they can be restored, then
          permanently deleted on an automated schedule. After that window,
          deleted content cannot be recovered.
        </p>
      </LegalSection>

      <LegalSection title="6. Availability and changes">
        <p>
          The Service is provided on an "as is" basis, without warranty of
          uninterrupted availability. Features described as upcoming or
          in-progress in the app are not yet available and may change before
          release.
        </p>
      </LegalSection>

      <LegalSection title="7. Termination">
        <p>
          We may suspend or terminate access to the Service for accounts that
          violate these terms or applicable law. You may stop using the Service
          at any time; workspace owners can delete their workspace directly from
          Settings.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitation of liability">
        <p>
          To the fullest extent permitted by law, the Service is provided
          without warranties of any kind, and its operators are not liable for
          indirect, incidental, or consequential damages arising from your use
          of it.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to these terms">
        <p>
          We may update these terms as the Service changes. Continued use of the
          Service after an update means you accept the revised terms.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          Questions about these terms can be directed to the workspace owner or
          the team maintaining this deployment of the Service.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
