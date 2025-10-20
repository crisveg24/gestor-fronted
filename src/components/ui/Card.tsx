import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

interface CardProps extends HTMLMotionProps<'div'> {
  children?: React.ReactNode;
  className?: string;
  hover?: boolean;
}

interface CardSectionProps {
  children?: React.ReactNode;
  className?: string;
}

const Card = ({ children, className = '', hover = false, ...props }: CardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hover ? { scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' } : {}}
      className={`
        bg-white rounded-xl shadow-md border border-gray-200
        overflow-hidden
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  );
};

const CardHeader = ({ children, className = '' }: CardSectionProps) => {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
};

const CardBody = ({ children, className = '' }: CardSectionProps) => {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  );
};

const CardFooter = ({ children, className = '' }: CardSectionProps) => {
  return (
    <div className={`px-6 py-4 border-t border-gray-200 bg-gray-50 ${className}`}>
      {children}
    </div>
  );
};

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
