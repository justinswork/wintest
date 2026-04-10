import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, GripVertical, ChevronUp, ChevronDown, X } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTestSuiteStore } from '../stores/testSuiteStore';
import { useTestStore } from '../stores/testStore';
import { showToast } from '../components/common/Toast';
import type { TestSuite } from '../api/types';

function SortableTestItem({ id, path, index, total, onMove, onRemove, t }: {
  id: string;
  path: string;
  index: number;
  total: number;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  t: (key: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="test-suite-test-item">
      <div className="drag-handle" {...attributes} {...listeners}><GripVertical size={16} /></div>
      <span className="test-suite-test-index">{index + 1}</span>
      <span className="test-suite-test-path">{path}</span>
      <div className="test-suite-test-actions">
        <button className="btn-icon" onClick={() => onMove(index, -1)} disabled={index === 0} title={t('common.moveUp')}><ChevronUp size={16} /></button>
        <button className="btn-icon" onClick={() => onMove(index, 1)} disabled={index === total - 1} title={t('common.moveDown')}><ChevronDown size={16} /></button>
        <button className="btn-icon danger" onClick={() => onRemove(index)} title={t('common.remove')}><X size={16} /></button>
      </div>
    </div>
  );
}

const EMPTY_TEST_SUITE: TestSuite = {
  name: '',
  filename: null,
  description: '',
  test_paths: [],
  settings: {},
};

export function TestSuiteEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { '*': filename } = useParams();
  const isEditing = !!filename;

  const { currentTestSuite, fetchTestSuite, saveTestSuite, setCurrentTestSuite } = useTestSuiteStore();
  const { tests, fetchTests } = useTestStore();

  const [testSuite, setTestSuite] = useState<TestSuite>(EMPTY_TEST_SUITE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTests();
    if (isEditing && filename) {
      fetchTestSuite(filename);
    } else {
      setCurrentTestSuite(null);
      setTestSuite(EMPTY_TEST_SUITE);
    }
  }, [filename, isEditing, fetchTestSuite, fetchTests, setCurrentTestSuite]);

  useEffect(() => {
    if (currentTestSuite && isEditing) {
      setTestSuite(currentTestSuite);
    }
  }, [currentTestSuite, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const savedFilename = await saveTestSuite(testSuite, isEditing ? filename : undefined);
      showToast(t('testSuiteEditor.saved'));
      if (!isEditing) {
        navigate(`/test-suites/${savedFilename}/edit`, { replace: true });
      }
    } catch {
      showToast(t('testSuiteEditor.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const addTestPath = (path: string) => {
    if (!testSuite.test_paths.includes(path)) {
      setTestSuite({ ...testSuite, test_paths: [...testSuite.test_paths, path] });
    }
  };

  const removeTestPath = (index: number) => {
    setTestSuite({
      ...testSuite,
      test_paths: testSuite.test_paths.filter((_, i) => i !== index),
    });
  };

  const moveTestPath = (index: number, direction: -1 | 1) => {
    const newPaths = [...testSuite.test_paths];
    const target = index + direction;
    if (target < 0 || target >= newPaths.length) return;
    [newPaths[index], newPaths[target]] = [newPaths[target], newPaths[index]];
    setTestSuite({ ...testSuite, test_paths: newPaths });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const testPathIds = testSuite.test_paths.map((_, i) => `test-path-${i}`);

  const handleDragEnd = (event: { active: { id: string | number }; over: { id: string | number } | null }) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = testPathIds.indexOf(String(active.id));
      const newIndex = testPathIds.indexOf(String(over.id));
      setTestSuite({ ...testSuite, test_paths: arrayMove(testSuite.test_paths, oldIndex, newIndex) });
    }
  };

  const availableTests = tests.filter(
    test => !testSuite.test_paths.includes(test.filename)
  );

  return (
    <div className="test-suite-editor">
      <div className="page-header">
        <h1>{isEditing ? t('testSuiteEditor.editTestSuite', { name: testSuite.name }) : t('testSuiteEditor.newTestSuite')}</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !testSuite.name}>
            <Save size={16} />{saving ? t('testSuiteEditor.saving') : t('testSuiteEditor.save')}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>{t('testSuiteEditor.testSuiteName')}</label>
        <input
          className="input"
          type="text"
          value={testSuite.name}
          onChange={(e) => setTestSuite({ ...testSuite, name: e.target.value })}
          placeholder={t('testSuiteEditor.testSuiteNamePlaceholder')}
        />
      </div>

      <div className="form-group">
        <label>{t('testSuiteEditor.description')}</label>
        <input
          className="input"
          type="text"
          value={testSuite.description}
          onChange={(e) => setTestSuite({ ...testSuite, description: e.target.value })}
          placeholder={t('testSuiteEditor.descriptionPlaceholder')}
        />
      </div>

      <div className="form-group">
        <label>{t('testSuiteEditor.failFast')}</label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={!!testSuite.settings.fail_fast}
            onChange={(e) => setTestSuite({
              ...testSuite,
              settings: { ...testSuite.settings, fail_fast: e.target.checked },
            })}
          />
          {t('testSuiteEditor.failFastDescription')}
        </label>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>{t('testSuiteEditor.tests')}</h2>
        </div>

        {testSuite.test_paths.length === 0 ? (
          <p className="empty-state">{t('testSuiteEditor.noTests')}</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={testPathIds} strategy={verticalListSortingStrategy}>
              <div className="test-suite-test-list">
                {testSuite.test_paths.map((path, index) => (
                  <SortableTestItem
                    key={testPathIds[index]}
                    id={testPathIds[index]}
                    path={path}
                    index={index}
                    total={testSuite.test_paths.length}
                    onMove={moveTestPath}
                    onRemove={removeTestPath}
                    t={t}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {availableTests.length > 0 && (
          <div className="test-suite-add-test">
            <label>{t('testSuiteEditor.addTest')}</label>
            <select
              className="input"
              onChange={(e) => {
                if (e.target.value) {
                  addTestPath(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>{t('testSuiteEditor.selectTest')}</option>
              {availableTests.map(test => (
                <option key={test.filename} value={test.filename}>
                  {test.name} ({test.filename})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
