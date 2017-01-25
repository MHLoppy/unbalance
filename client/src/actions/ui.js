module.exports = {
	setOpInProgress,
	addFeedback,
	removeFeedback,
}

function setOpInProgress({ state }, action) {
	return {
		...state,
		opInProgress: action,
	}
}

function addFeedback({ state, actions }, feedback) {
	if (state.timeout) {
		window.clearTimeout(state.timeout)
	}
	const timeout = window.setTimeout(() => actions.removeFeedback(), 15000)

	return {
		...state,
		timeout,
		feedback: [].concat(feedback),
	}
}

function removeFeedback({ state }) {
	return {
		...state,
		feedback: [],
		timeout: null,
	}
}
