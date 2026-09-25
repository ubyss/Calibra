import { Clock3, HardDrive, KeyRound, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

import { ConnectForm } from './ConnectForm';
import styles from './ConnectPage.module.css';

const PROMISES = [
  {
    icon: HardDrive,
    title: 'Tudo fica no seu navegador',
    text: 'Worklogs, relatórios e configurações são salvos localmente. Sem servidores intermediários.',
  },
  {
    icon: ShieldCheck,
    title: 'Sem rastreamento',
    text: 'Nenhum analytics, telemetria ou relatório de erros é enviado para terceiros.',
  },
  {
    icon: KeyRound,
    title: 'Conversa só com o seu Jira',
    text: 'A extensão pede acesso apenas ao endereço que você informar aqui.',
  },
];

export function ConnectPage() {
  return (
    <div className={styles.connectPage}>
      <div className={styles.connectPage__layout}>
        <motion.div
          className={styles.connectPage__intro}
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {[
            <span key="logo" className={styles.connectPage__logo}>
              <Clock3 size={24} strokeWidth={2.4} aria-hidden />
            </span>,
            <h1 key="title" className={styles.connectPage__title}>
              Suas horas no Jira,
              <br />
              sem atrito.
            </h1>,
            <p key="lead" className={styles.connectPage__lead}>
              Cronometre, organize a semana e envie seus worklogs em lote. Simples, rápido e privado.
            </p>,
            <ul key="promises" className={styles.connectPage__promises}>
              {PROMISES.map(({ icon: Icon, title, text }) => (
                <li key={title} className={styles.connectPage__promise}>
                  <span className={styles.connectPage__promiseIcon}>
                    <Icon size={16} aria-hidden />
                  </span>
                  <span>
                    <span className={styles.connectPage__promiseTitle}>{title}</span>
                    <br />
                    <span className={styles.connectPage__promiseText}>{text}</span>
                  </span>
                </li>
              ))}
            </ul>,
          ].map((element) => (
            <motion.div
              key={element.key}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            >
              {element}
            </motion.div>
          ))}
        </motion.div>

        <ConnectForm />
      </div>
    </div>
  );
}
