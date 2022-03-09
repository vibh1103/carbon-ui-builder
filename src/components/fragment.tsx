import React from 'react';
import { SkeletonPlaceholder } from 'carbon-components-react';
import './fragment-preview.scss';
import { css, cx } from 'emotion';
import { allComponents, ComponentInfoRenderProps } from '../fragment-components';
import { getAllFragmentStyleClasses } from '../utils/fragment-tools';

const canvas = css`
	border: 2px solid #d8d8d8;
	background-color: white;
	position: relative;
`;

const allowDrop = (event: any) => {
	event.preventDefault();
}

let componentCounter = 2; // actually initialized (again) in Fragment

export const getComponentById = (componentObj: any, id: number) => {
	if (!componentObj || !id) {
		return undefined;
	}

	if (componentObj.id === id) {
		return componentObj;
	}

	if (componentObj.items) {
		for (let i = 0; i < componentObj.items.length; i++) {
			const component: any = getComponentById(componentObj.items[i], id);
			if (component) {
				return component;
			}
		}
	}

	return undefined;
};

export const getSelectedComponent = (fragment: any) => {
	if (!fragment) {
		return undefined;
	}

	return getComponentById(fragment.data, fragment.selectedComponentId)
};

export const getHighestId = (componentObj: any) => {
	if (!componentObj) {
		return 0;
	}

	if (!componentObj.items || !componentObj.items.length) {
		return componentObj.id || 0;
	}

	return Math.max(...componentObj.items.map((item: any) => getHighestId(item)), (componentObj.id || 0));
};

export const stateWithoutComponent = (state: any, componentId: number) => {
	if (state.items) {
		const componentIndex = state.items.findIndex((component: any) => component.id === componentId);
		if (componentIndex >= 0) {
			return {
				...state,
				items: [...state.items.slice(0, componentIndex), ...state.items.slice(componentIndex + 1)]
			}
		}

		return {
			...state,
			items: state.items.map((item: any) => stateWithoutComponent(item, componentId))
		}
	}

	return { ...state };
};

export const initializeIds = (componentObj: any) => {
	const id = componentObj.id || componentCounter++;
	// name is used in form items and for angular inputs and outputs variable names
	const name = componentObj.codeContext?.name || `${componentObj.type}-${id}`;

	return {
		...componentObj,
		id,
		items: componentObj.items ? componentObj.items.map((co: any) => initializeIds(co)) : undefined,
		codeContext: {
			name
		}
	};
}

const updatedList = (list: any[], item: any, dropInIndex?: number) => {
	if (dropInIndex === undefined) {
		return [...list, item];
	}

	return [...list.slice(0, dropInIndex), item, ...list.slice(dropInIndex)];
};

export const updatedState = (state: any, dragObj: any, dropInId?: number, dropInIndex?: number) => {
	if (!state) { // NOTE is this needed?
		return;
	}

	// give unique ids to newly dropped components
	dragObj.component = initializeIds(dragObj.component);

	// only update
	if (dragObj.type === 'update') {
		if (state.id && state.id === dragObj.component.id) {
			return {
				...state,
				...dragObj.component
			}
		}
		if (state.items) {
			state.items = state.items.map((item: any) => updatedState(item, dragObj, dropInId, dropInIndex));
		}

		return { ...state };
	}

	if (dragObj.type === 'move') {
		state = stateWithoutComponent(state, dragObj.component.id);
		dragObj.type = 'insert'
	}


	if (state.items) {
		state.items = state.items.map((item: any) => updatedState(item, dragObj, dropInId, dropInIndex));
	}

	if (!dropInId) {
		return state.items && !state.type ? {
			...state,
			items: updatedList(state.items, dragObj.component, dropInIndex)
		} : { ...state };
	}
///////////// TODO NOTE clean the container items with 1 item //////////////
	if (state.id && state.id === dropInId) {
		// add data into state
		if (state.items) {
			return {
				...state,
				items: updatedList(state.items, dragObj.component, dropInIndex),
				id: state.id
			}
		}

		// convert into a list of components, move current component into list
		return {
			// TODO should this be a `type: container`?
			id: componentCounter++,
			items: updatedList([{...state}], dragObj.component, dropInIndex)
		}
	}

	if (dropInId) { // probably don't wanna add it here since it didn't match anything and it should somewhere
		return { ...state };
	}

	return state.items ? {
		...state,
		items: updatedList(state.items, dragObj.component, dropInIndex)
	} : { ...state };
}

export const getParentComponent = (state: any, child: any) => {
	if (state && state.items) {
		if (state.items.includes(child)) {
			return state;
		}
		for (let i = 0; i < state.items.length; i++) {
			const component = state.items[i];
			const parent: any = getParentComponent(component, child);
			if (parent) {
				return parent;
			}
		}
	}

	return null;
};

export const Fragment = ({fragment, setFragment}: any) => {
	if (!fragment || !fragment.data) { return <SkeletonPlaceholder />; }

	// initialize component counter
	componentCounter = getHighestId(fragment.data) + 1;

	const drop = (event: any, dropInId?: number) => {
		event.preventDefault();

		const dragObj = JSON.parse(event.dataTransfer.getData("drag-object"));

		setFragment({
			...fragment,
			data: updatedState(fragment.data, dragObj, dropInId)
		});
	}

	const select = (componentObj: any) => {
		setFragment({
			...fragment,
			selectedComponentId: componentObj.id
		}, true);
	};

	const remove = (componentObj: any) => {
		setFragment({
			...fragment,
			data: stateWithoutComponent(fragment.data, componentObj.id)
		});
	};

	const renderComponents = (componentObj: any): any => {
		if (typeof componentObj === 'string' || !componentObj) {
			return componentObj;
		}

		for (let [key, component] of Object.entries(allComponents)) {
			if (componentObj.type === key) {
				if (component.componentInfo.render) {
					return component.componentInfo.render({
						componentObj,
						select: () => select(componentObj),
						remove: () => remove(componentObj),
						selected: fragment.selectedComponentId === componentObj.id,
						onDragOver: allowDrop,
						onDrop: (event: any) => { event.stopPropagation(); drop(event, componentObj.id); },
						renderComponents
					} as ComponentInfoRenderProps);
				}
				return <component.componentInfo.component
					componentObj={componentObj}
					select={() => select(componentObj)}
					remove={() => remove(componentObj)}
					selected={fragment.selectedComponentId === componentObj.id}>
						{componentObj.items && componentObj.items.map((row: any) => renderComponents(row))}
				</component.componentInfo.component>
			}
		}

		if (componentObj.items) {
			return componentObj.items.map((item: any) => renderComponents(item));
		}

		return null;
	};

	const styles = css`
		${
			getAllFragmentStyleClasses(fragment).map((styleClass: any) => `.${styleClass.id} {
				${styleClass.content}
			}`)
		}
	`;
	// TODO add fragment.width and fragment.height to database
	return (
		<div
		className={cx(
			canvas,
			styles,
			css`width: ${fragment.width || '800px'}; height: ${fragment.height || '600px'}`
		)}
		onDragOver={allowDrop}
		onDrop={(event: any) => { drop(event, fragment.data.id) }}>
			<div className={`${fragment.cssClasses ? fragment.cssClasses.map((cc: any) => cc.id).join(' ') : ''}`}>
				{renderComponents(fragment.data)}
			</div>
		</div>
	);
};
