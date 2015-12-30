import B from 'baconjs'
import path from 'path'

import Dispatcher from './lib/dispatcher'
import * as C from './constant'

import Api from './lib/api'
import WebSocketApi from './lib/wsapi'

// state = {
// 	config: {
// 		folders: [
// 			"movies/films",
// 			"movies/tvshows"
// 		],
// 		dryRun: true
// 	}
// 	unraid: {
// 		condition: {
// 			numDisks: 24,
// 			numProtected: 0,
//			state: "STARTED",
// 		},
// 		disks: [
// 			{id: 1, name: "disk1", path: "/mnt/disk1"},
// 			{id: 2, name: "disk2", path: "/mnt/disk2"},
// 			{id: 3, name: "disk3", path: "/mnt/disk3"},
// 		],
// 		bytesToMove: 0,
// 		inProgress: false, // need to review this variable
// 	}
//  fromDisk: null,
//  toDisk: null,
//  opInProgress: null,
//  moveDisabled: true,
//  lines: [],
// 	tree: {
// 		items: 
// 			'/': [
// 				{type: 'folder', path: '/films'}
// 				{type: 'folder', path: '/tvshows'}
// 				{type: 'folder', path: '/storage'}
// 				{type: 'folder', path: '/data'}
// 			],
// 		selected: "",
// 		fetching: false,
// 	}
// }

export default class Store {
	constructor(initialState = {}) {
		const api = new Api()
		const ws = new WebSocketApi()

		this.state = this._setup(initialState, api, ws, Dispatcher.dispatch, Dispatcher.register)
	}

	get status() {
		return this.state
	}

	_setup(initialState, api, ws, dispatch, register) {
		const [
			start, 
			getConfig,
			gotConfig,
			addFolder,
			folderAdded,
			deleteFolder,
			folderDeleted,
			opInProgress,
			getStorage,
			gotStorage,
			calculate,
			calcStarted,
			calcProgress,
			calcFinished,
			move,
			moveStarted,
			moveProgress,
			moveFinished,
			toggleDryRun,
			dryRunToggled,
			checkFrom,
			checkTo,
			treeItemClicked,
			gotTree,
		] = register(
			C.START,
			C.GET_CONFIG,
			C.GOT_CONFIG,
			C.ADD_FOLDER,
			C.FOLDER_ADDED,
			C.DELETE_FOLDER,
			C.FOLDER_DELETED,
			C.OP_IN_PROGRESS,
			C.GET_STORAGE,
			C.GOT_STORAGE,
			C.CALCULATE,
			C.CALC_STARTED,
			C.CALC_PROGRESS,
			C.CALC_FINISHED,
			C.MOVE,
			C.MOVE_STARTED,
			C.MOVE_PROGRESS,
			C.MOVE_FINISHED,
			C.TOGGLE_DRY_RUN,
			C.DRY_RUN_TOGGLED,
			C.CHECK_FROM,
			C.CHECK_TO,
			C.TREE_ITEM_CLICKED,
			C.GOT_TREE,
		)

		// const ws = new WebSocket(WS_URL)

		ws.stream.onValue(event => {
			// console.log('streaming: ', event)
			dispatch(event.topic, event.payload)
		})

		return B.update(
			initialState,
			getConfig, _getConfig,
			gotConfig, _gotConfig,
			addFolder, _addFolder,
			folderAdded, _folderAdded,
			deleteFolder, _deleteFolder,
			folderDeleted, _folderDeleted,
			opInProgress, _opInProgress,
			getStorage, _getStorage,
			gotStorage, _gotStorage,
			calculate, _calculate,
			calcStarted, _calcStarted,
			calcProgress, _calcProgress,
			calcFinished, _calcFinished,
			checkFrom, _checkFrom,
			checkTo, _checkTo,
			move, _move,
			moveStarted, _moveStarted,
			moveProgress, _moveProgress,
			moveFinished, _moveFinished,
			toggleDryRun, _toggleDryRun,
			dryRunToggled, _dryRunToggled,
			treeItemClicked, _treeItemClicked,
			gotTree, _gotTree,
		)

		function _getConfig(state, _) {
			dispatch(C.OP_IN_PROGRESS, C.GET_CONFIG)

			B.fromPromise(api.getConfig()).onValue(json => {
				dispatch(C.GOT_CONFIG, json)
			})

			return state
		}

		function _gotConfig(state, config) {
			return {
				...state,
				config: config,
				opInProgress: null,
			}
		}

		function _addFolder(state, folder) {
			if (state.config.folders.indexOf(folder) !== -1) {
				return state
			}

			dispatch(C.OP_IN_PROGRESS, C.ADD_FOLDER)

			B.fromPromise(api.addFolder(folder)).onValue(json => {
				dispatch(C.FOLDER_ADDED, json)
			})

			return state
		}

		function _folderAdded(state, config) {
			return {
				...state,
				config: config,
				opInProgress: null,
			}
		}

		function _deleteFolder(state, folder) {
			dispatch(C.OP_IN_PROGRESS, C.ADD_FOLDER)

			B.fromPromise(api.deleteFolder(folder)).onValue(json => {
				dispatch(C.FOLDER_DELETED, json)
			})

			return state
		}

		function _folderDeleted(state, config) {
			return {
				...state,
				config: config,
				opInProgress: null,
			}
		}

		function _opInProgress(state, action) {
			return {
				...state,
				opInProgress: action
			}
		}

		function _getStorage(state, _) {
			dispatch(C.OP_IN_PROGRESS, C.GET_STORAGE)

			B.fromPromise(api.getStorage()).onValue(json => {
				dispatch(C.GOT_STORAGE, json)
			})

			return state
		}

		function _gotStorage(state, unraid) {
			console.log('unraid: ', unraid)
		
			let toDisk = {}
			let fromDisk = {}
			let maxFreeSize = 0
			let maxFreePath = ""

			unraid.disks.map( disk => {
				toDisk[disk.path] = true
				fromDisk[disk.path] = false

				if (disk.free > maxFreeSize) {
					maxFreeSize = disk.free
					maxFreePath = disk.path
				}

				return disk
			})

			if (maxFreePath != "") {
				toDisk[maxFreePath] = false
				fromDisk[maxFreePath] = true
			}

			return {
				...state,
				opInProgress: null,
				moveDisabled: true,
				lines: [],
				unraid,
				fromDisk,
				toDisk,
			}
		}

		function _calculate(state, _) {
			dispatch(C.OP_IN_PROGRESS, C.CALCULATE)

			let srcDisk = ""

			for (var key in state.fromDisk) {
				if (state.fromDisk[key]) {
					srcDisk = key
					break
				}
			}			

			ws.send({topic: C.CALCULATE, payload: {srcDisk, dstDisks: state.toDisk}})
			return state
		}

		function _calcStarted(state, payload) {
			return {
				...state,
				lines: [].concat('CALCULATE: ' + payload),
			}
		}

		function _calcProgress(state, payload) {
			return {
				...state,
				lines: state.lines.concat('CALCULATE: ' + payload),
			}
		}

		function _calcFinished(state, unraid) {
			return {
				...state,
				unraid,
				opInProgress: null,
				moveDisabled: false,
			}
		}

		function _checkFrom(state, path) {
			let fromDisk = Object.assign({}, state.fromDisk)
			for (var key in fromDisk) {
				if (key !== path) {
					fromDisk[key] = false
				}
			}
			fromDisk[path] = true

			let toDisk = Object.assign({}, state.toDisk)
			for (var key in toDisk) {
				toDisk[key] = !(key === path)
			}

			return {
				...state,
				fromDisk,
				toDisk,
			}
		}

		function _checkTo(state, path) {
			let toDisk = Object.assign({}, state.toDisk)
			toDisk[path] = !toDisk[path]

			return {
				...state,
				toDisk,
			}		
		}

		function _move(state) {
			dispatch(C.OP_IN_PROGRESS, C.MOVE)

			ws.send({topic: C.MOVE})
			return state			
		}

		function _moveStarted(state, payload) {
			return {
				...state,
				lines: [].concat('MOVE: ' + payload),
			}
		}

		function _moveProgress(state, payload) {
			return {
				...state,
				lines: state.lines.concat('MOVE: ' + payload),
			}
		}

		function _moveFinished(state, unraid) {
			let moveDisabled = !state.config.dryRun
			console.log('moveDisabled: ', moveDisabled)
			return {
				...state,
				unraid,
				opInProgress: null,
				moveDisabled,
			}
		}

		function _toggleDryRun(state, _) {
			dispatch(C.OP_IN_PROGRESS, C.TOGGLE_DRY_RUN)

			B.fromPromise(api.toggleDryRun()).onValue(json => {
				dispatch(C.DRY_RUN_TOGGLED, json)
			})

			return state			
		}

		function _dryRunToggled(state, config) {
			return {
				...state,
				config,
				opInProgress: null
			}
		}

		function _treeItemClicked(state, item) {
			let items = Object.assign({}, state.tree.items)

			let open = items[item.path]
			// let items = Object.assign({}, state.tree.items)

			// dispatch(C.SELECT_TREE_ITEM, item)

			let fetching = false

			// if (item.type !== 'folder') dispatch(C.TREE_FILE_SELECTED, item)

			if (open) {
				// dispatch(C.CLOSE_TREE_ITEM, item)
				delete items[item.path]
				Object.keys(items).forEach( p => {
					if (path.join(p, '/').indexOf(path.join(item.path, '/')) === 0) delete items[p]
				})

			} else {
				fetching = true
				B.fromPromise(api.getTree(item.path)).onValue(json => {
					dispatch(C.GOT_TREE, json)
				})
			}

			return {
				...state,
				tree: {items, selected: item.path, fetching},
			}
		}

		function _gotTree(state, newTree) {
			console.log('newTree: ', newTree)
			let tree = state.tree

			tree.items[newTree.path] = newTree.nodes
			tree.fetching = false

			return {
				...state,
				tree
			}
		}
	}
}


// export default function createStore(initialState = {}, dispatcher) {
// 	let state = { ...initialState, dispatch: dispatcher.dispatch }

// 	return B.combineTemplate


// }