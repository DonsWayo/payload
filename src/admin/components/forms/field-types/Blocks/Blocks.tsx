import React, {
  useEffect, useReducer, useCallback, useState,
} from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';

import withCondition from '../../withCondition';
import Button from '../../../elements/Button';
import reducer from '../rowReducer';
import { useForm } from '../../Form/context';
import buildStateFromSchema from '../../Form/buildStateFromSchema';
import DraggableSection from '../../DraggableSection';
import Error from '../../Error';
import useFieldType from '../../useFieldType';
import Popup from '../../../elements/Popup';
import BlockSelector from './BlockSelector';
import { blocks as blocksValidator } from '../../../../../fields/validations';
import Banner from '../../../elements/Banner';
import { Props, RenderBlockProps } from './types';

import './index.scss';

const baseClass = 'field-type blocks';

const labelDefaults = {
  singular: 'Block',
  plural: 'Blocks',
};

const Blocks: React.FC<Props> = (props) => {
  const {
    label,
    name,
    path: pathFromProps,
    blocks,
    labels = labelDefaults,
    fieldTypes,
    maxRows,
    minRows,
    required,
    validate = blocksValidator,
    permissions,
    admin: {
      readOnly,
    },
  } = props;

  const path = pathFromProps || name;

  const [rows, dispatchRows] = useReducer(reducer, []);
  const formContext = useForm();
  const { dispatchFields } = formContext;

  const memoizedValidate = useCallback((value) => {
    const validationResult = validate(
      value,
      {
        minRows, maxRows, labels, blocks, required,
      },
    );
    return validationResult;
  }, [validate, maxRows, minRows, labels, blocks, required]);

  const [disableFormData, setDisableFormData] = useState(false);

  const {
    showError,
    errorMessage,
    value,
    setValue,
  } = useFieldType({
    path,
    validate: memoizedValidate,
    disableFormData,
    ignoreWhileFlattening: true,
  });

  const addRow = useCallback(async (rowIndex, blockType) => {
    const block = blocks.find((potentialBlock) => potentialBlock.slug === blockType);

    const subFieldState = await buildStateFromSchema(block.fields);

    dispatchFields({ type: 'ADD_ROW', rowIndex, subFieldState, path, blockType });
    dispatchRows({ type: 'ADD', rowIndex, blockType });
    setValue(value as number + 1);
  }, [path, setValue, value, blocks, dispatchFields]);

  const removeRow = useCallback((rowIndex) => {
    dispatchRows({ type: 'REMOVE', rowIndex });
    dispatchFields({ type: 'REMOVE_ROW', rowIndex, path });
    setValue(value as number - 1);
  }, [path, setValue, value, dispatchFields]);

  const moveRow = useCallback((moveFromIndex, moveToIndex) => {
    dispatchRows({ type: 'MOVE', moveFromIndex, moveToIndex });
    dispatchFields({ type: 'MOVE_ROW', moveFromIndex, moveToIndex, path });
  }, [dispatchRows, dispatchFields, path]);

  const toggleCollapse = useCallback((rowIndex) => {
    dispatchRows({ type: 'TOGGLE_COLLAPSE', rowIndex });
  }, []);

  const onDragEnd = useCallback((result) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    moveRow(sourceIndex, destinationIndex);
  }, [moveRow]);

  useEffect(() => {
    const data = formContext.getDataByPath(path);
    dispatchRows({ type: 'SET_ALL', data: data || [] });
  }, [formContext, path]);

  useEffect(() => {
    setValue(rows?.length || 0);

    if (rows?.length === 0) {
      setDisableFormData(false);
    } else {
      setDisableFormData(true);
    }
  }, [rows, setValue]);

  return (
    <RenderBlocks
      onDragEnd={onDragEnd}
      label={label}
      showError={showError}
      errorMessage={errorMessage}
      rows={rows}
      labels={labels}
      addRow={addRow}
      removeRow={removeRow}
      moveRow={moveRow}
      path={path}
      name={name}
      fieldTypes={fieldTypes}
      toggleCollapse={toggleCollapse}
      permissions={permissions}
      value={value as number}
      blocks={blocks}
      readOnly={readOnly}
      minRows={minRows}
      maxRows={maxRows}
      required={required}
    />
  );
};

const RenderBlocks = React.memo((props: RenderBlockProps) => {
  const {
    onDragEnd,
    label,
    showError,
    errorMessage,
    rows,
    labels,
    addRow,
    removeRow,
    moveRow,
    path,
    fieldTypes,
    permissions,
    value,
    toggleCollapse,
    blocks,
    readOnly,
    minRows,
    maxRows,
    required,
  } = props;

  const hasMaxRows = maxRows && rows.length >= maxRows;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div
        className={baseClass}
      >
        <header className={`${baseClass}__header`}>
          <h3>{label}</h3>

          <Error
            showError={showError}
            message={errorMessage}
          />
        </header>

        <Droppable
          droppableId="blocks-drop"
          isDropDisabled={readOnly}
        >
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {rows.length > 0 && rows.map((row, i) => {
                const { blockType } = row;
                const blockToRender = blocks.find((block) => block.slug === blockType);

                if (blockToRender) {
                  return (
                    <DraggableSection
                      readOnly={readOnly}
                      key={row.key}
                      id={row.key}
                      blockType="blocks"
                      blocks={blocks}
                      label={blockToRender?.labels?.singular}
                      isOpen={row.open}
                      rowCount={rows.length}
                      rowIndex={i}
                      addRow={addRow}
                      removeRow={removeRow}
                      moveRow={moveRow}
                      toggleRowCollapse={toggleCollapse}
                      parentPath={path}
                      fieldTypes={fieldTypes}
                      permissions={permissions}
                      hasMaxRows={hasMaxRows}
                      fieldSchema={[
                        ...blockToRender.fields,
                        {
                          name: 'blockType',
                          type: 'text',
                          admin: {
                            hidden: true,
                          },
                        },
                      ]}
                    />
                  );
                }

                return null;
              })}
              {(rows.length < minRows || (required && rows.length === 0)) && (
                <Banner type="error">
                  This field requires at least
                  {' '}
                  {minRows
                    ? `${minRows} ${labels.plural}`
                    : `1 ${labels.singular}`}
                </Banner>
              )}
              {(rows.length === 0 && readOnly) && (
                <Banner>
                  This field has no
                  {' '}
                  {labels.plural}
                  .
                </Banner>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {(!readOnly && (rows.length < maxRows || maxRows === undefined)) && (
          <div className={`${baseClass}__add-button-wrap`}>
            <Popup
              buttonType="custom"
              size="large"
              horizontalAlign="left"
              button={(
                <Button
                  buttonStyle="icon-label"
                  icon="plus"
                  iconPosition="left"
                  iconStyle="with-border"
                >
                  {`Add ${labels.singular}`}
                </Button>
              )}
              render={({ close }) => (
                <BlockSelector
                  blocks={blocks}
                  addRow={addRow}
                  addRowIndex={value}
                  close={close}
                />
              )}
            />
          </div>
        )}
      </div>
    </DragDropContext>
  );
});

export default withCondition(Blocks);
