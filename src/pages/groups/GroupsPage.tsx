import { Plus, Trash2, Users, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/FeedbackStates';
import { TextInput } from '@/components/ui/FormField';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { UserPicker } from '@/components/user/UserPicker';
import { useStoredValue } from '@/hooks/useStoredValue';
import styles from '@/pages/organization/OrganizationPages.module.css';
import { updateStorage } from '@/services/storage';
import type { JiraUserSummary, UserGroup } from '@/types/domain';
import { createId, getInitials } from '@/utils/misc';

function updateGroup(groupId: string, updater: (group: UserGroup) => UserGroup): Promise<UserGroup[]> {
  return updateStorage('groups', (groups) => groups.map((group) => (group.id === groupId ? updater(group) : group)));
}

function GroupCard({ group }: { group: UserGroup }) {
  const addUser = (user: JiraUserSummary): void =>
    void updateGroup(group.id, (current) => ({ ...current, users: [...current.users, user] }));
  const removeUser = (userId: string): void =>
    void updateGroup(group.id, (current) => ({ ...current, users: current.users.filter((user) => user.id !== userId) }));
  const deleteGroup = (): void => {
    if (window.confirm(`Excluir o grupo "${group.name}"?`)) {
      void updateStorage('groups', (groups) => groups.filter((item) => item.id !== group.id));
    }
  };

  return (
    <SurfacePanel
      title={group.name}
      subtitle={group.users.length === 1 ? '1 pessoa' : `${group.users.length} pessoas`}
      actions={<ActionButton variant="ghost" isCompact icon={Trash2} label="Excluir grupo" onClick={deleteGroup} />}
    >
      <UserPicker excludedIds={group.users.map((user) => user.id)} onSelect={addUser} />
      <div className={styles.organizationPage__members}>
        <AnimatePresence initial={false}>
          {group.users.map((user) => (
            <motion.span
              key={user.id}
              layout
              className={styles.organizationPage__member}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <span className={styles.organizationPage__memberAvatar} aria-hidden>
                {getInitials(user.displayName)}
              </span>
              {user.displayName}
              <button
                type="button"
                className={styles.organizationPage__memberRemove}
                aria-label={`Remover ${user.displayName}`}
                onClick={() => removeUser(user.id)}
              >
                <X size={14} aria-hidden />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </SurfacePanel>
  );
}

export function GroupsPage() {
  const { value: groups } = useStoredValue('groups');
  const [newGroupName, setNewGroupName] = useState('');

  const handleCreate = (event: FormEvent): void => {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!name) {
      return;
    }
    void updateStorage('groups', (current) => [...current, { id: createId(), name, users: [] }]);
    setNewGroupName('');
  };

  return (
    <div className={styles.organizationPage}>
      <PageHeader title="Grupos" description="Agrupe pessoas para gerar o relatório de horas da equipe." />

      <SurfacePanel title="Novo grupo">
        <form className={styles.organizationPage__inlineForm} onSubmit={handleCreate}>
          <TextInput
            value={newGroupName}
            placeholder="Ex.: Squad Pagamentos"
            aria-label="Nome do grupo"
            onChange={(event) => setNewGroupName(event.target.value)}
          />
          <ActionButton type="submit" variant="primary" icon={Plus} disabled={!newGroupName.trim()}>
            Criar
          </ActionButton>
        </form>
      </SurfacePanel>

      {groups.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum grupo criado" description="Crie um grupo e adicione as pessoas do seu time." />
      ) : (
        <div className={styles.organizationPage__groups}>
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
