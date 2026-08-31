// Inspired by react-hot-toast library
import { useState, useEffect } from "react";

const TOAST_LIMIT = 20;
const TOAST_REMOVE_DELAY = 1000; // time to let the close animation finish
const DEFAULT_TOAST_DURATION = 5000; // how long a toast stays visible by default

/**
 * @typedef {Object} ToasterToast
 * @property {string} id
 * @property {import('react').ReactNode} [title]
 * @property {import('react').ReactNode} [description]
 * @property {import('react').ReactNode} [action]
 * @property {boolean} [open]
 * @property {(open: boolean) => void} [onOpenChange]
 * @property {"default" | "destructive"} [variant]
 * @property {string} [className]
 * @property {number} [duration]
 */

/**
 * @typedef {Omit<ToasterToast, 'id'>} ToastInput
 */

const actionTypes = /** @type {const} */ ({
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
});

/**
 * @typedef {{ type: "ADD_TOAST", toast: ToasterToast }} AddToastAction
 * @typedef {{ type: "UPDATE_TOAST", toast: Partial<ToasterToast> & { id: string } }} UpdateToastAction
 * @typedef {{ type: "DISMISS_TOAST", toastId?: string }} DismissToastAction
 * @typedef {{ type: "REMOVE_TOAST", toastId?: string }} RemoveToastAction
 * @typedef {AddToastAction | UpdateToastAction | DismissToastAction | RemoveToastAction} Action
 */

/**
 * @typedef {{ toasts: ToasterToast[] }} State
 */

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const toastTimeouts = new Map();

/**
 * Schedules DOM removal after a toast has been dismissed (open: false),
 * giving the exit animation time to play.
 * @param {string} toastId
 */
const addToRemoveQueue = (toastId) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: actionTypes.REMOVE_TOAST,
      toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const autoDismissTimeouts = new Map();

/**
 * Schedules automatic dismissal of a toast after its display duration.
 * @param {string} toastId
 * @param {number} duration
 */
const scheduleAutoDismiss = (toastId, duration) => {
  if (autoDismissTimeouts.has(toastId)) {
    clearTimeout(autoDismissTimeouts.get(toastId));
  }

  const timeout = setTimeout(() => {
    autoDismissTimeouts.delete(toastId);
    dispatch({ type: actionTypes.DISMISS_TOAST, toastId });
  }, duration);

  autoDismissTimeouts.set(toastId, timeout);
};

/**
 * Cancels a pending auto-dismiss (e.g. if the toast is manually
 * dismissed or updated before its timer fires).
 * @param {string} toastId
 */
const clearAutoDismiss = (toastId) => {
  const timeout = autoDismissTimeouts.get(toastId);
  if (timeout) {
    clearTimeout(timeout);
    autoDismissTimeouts.delete(toastId);
  }
};

/**
 * @param {State} state
 * @param {Action} action
 * @returns {State}
 */
export const reducer = (state, action) => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      };

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        clearAutoDismiss(toastId);
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          clearAutoDismiss(toast.id);
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
    default:
      return state;
  }
};

/** @type {Array<(state: State) => void>} */
const listeners = [];

/** @type {State} */
let memoryState = { toasts: [] };

/**
 * @param {Action} action
 */
function dispatch(action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

/**
 * @param {ToastInput} props
 */
function toast({ duration = DEFAULT_TOAST_DURATION, ...props }) {
  const id = genId();

  /**
   * @param {Partial<ToasterToast>} props
   */
  const update = (props) =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...props, id },
    });

  const dismiss = () =>
    dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      /** @param {boolean} open */
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  if (duration !== Infinity) {
    scheduleAutoDismiss(id, duration);
  }

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = useState(memoryState);

  useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    /** @param {string} [toastId] */
    dismiss: (toastId) =>
      dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  };
}

export { useToast, toast };
