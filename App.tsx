import { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, View, StyleSheet } from 'react-native';

import TaskContext, { Task } from './app/models/Task';
import IntroText from './app/components/IntroText';
import AddTaskForm from './app/components/AddTaskForm';
import Realm from 'realm';
import TaskList from './app/components/TaskList';
import colors from './app/styles/colors';
import { appId, baseUrl } from './realm.json';

const { RealmProvider } = TaskContext;

function App() {
  const [tasks, setTasks] = useState([]);
  const realmReference = useRef(null);

  const handleAddTask = useCallback(
    (description: string): void => {
      if (!description) {
        return;
      }

      console.log(realmReference);

      // Everything in the function passed to "realm.write" is a transaction and will
      // hence succeed or fail together. A transcation is the smallest unit of transfer
      // in Realm so we want to be mindful of how much we put into one single transaction
      // and split them up if appropriate (more commonly seen server side). Since clients
      // may occasionally be online during short time spans we want to increase the probability
      // of sync participants to successfully sync everything in the transaction, otherwise
      // no changes propagate and the transaction needs to start over when connectivity allows.
      realmReference.current.write(() => {
        realmReference.current.create('Task', Task.generate(description));
      });
    },
    [realmReference],
  );

  const handleToggleTaskStatus = useCallback(
    (task: Task): void => {
      realmReference.current.write(() => {
        // Normally when updating a record in a NoSQL or SQL database, we have to type
        // a statement that will later be interpreted and used as instructions for how
        // to update the record. But in RealmDB, the objects are "live" because they are
        // actually referencing the object's location in memory on the device (memory mapping).
        // So rather than typing a statement, we modify the object directly by changing
        // the property values. If the changes adhere to the schema, Realm will accept
        // this new version of the object and wherever this object is being referenced
        // locally will also see the changes "live".
        task.isComplete = !task.isComplete;
      });

      // Alternatively if passing the ID as the argument to handleToggleTaskStatus:
      // realm?.write(() => {
      //   const task = realm?.objectForPrimaryKey('Task', id); // If the ID is passed as an ObjectId
      //   const task = realm?.objectForPrimaryKey('Task', Realm.BSON.ObjectId(id));  // If the ID is passed as a string
      //   task.isComplete = !task.isComplete;
      // });
    },
    [realmReference],
  );

  const handleDeleteTask = useCallback(
    (task: Task): void => {
      realmReference.current.write(() => {
        realmReference.current.delete(task);

        // Alternatively if passing the ID as the argument to handleDeleteTask:
        // realm?.delete(realm?.objectForPrimaryKey('Task', id));
      });
    },
    [realmReference],
  );

  useEffect(() => {
    const initializeRealm = async () => {
      console.log('Initializing Realm...');
      const appConfiguration = {
        id: appId,
        baseUrl,
      };

      const realmApp = new Realm.App(appConfiguration);
      const credentials = Realm.Credentials.anonymous(); // create an anonymous credential
      const user = await realmApp.logIn(credentials);

      const config = {
        schema: [Task.schema],
        sync: {
          user,
          partitionValue: user.id,
        },
      };

      const realm = await Realm.open(config);
      realmReference.current = realm;

      // if the realm exists, get all Task items and add a listener on the Task collection
      if (realm) {
        // Get all Task items, sorted by name
        const sortedTasks = realmReference.current
          .objects('Task')
          .sorted('createdAt');
        // set the sorted Tasks to state as an array, so they can be rendered as a list
        setTasks([...sortedTasks]);
        // watch for changes to the Task collection. When tasks are created,
        // modified or deleted the 'sortedTasks' variable will update with the new
        // live Task objects, and then the Tasks in state will be updated to the
        // sortedTasks
        sortedTasks.addListener(() => {
          setTasks([...sortedTasks]);
        });

        console.log('Listening for changes to the Task collection...');
      }
    };

    initializeRealm();

    // cleanup function to close realm after component unmounts
    return () => {
      const realm = realmReference.current;
      // if the realm exists, close the realm
      if (realm) {
        realm.close();
        // set the reference to null so the realm can't be used after it is closed
        realmReference.current = null;
        setTasks([]); // set the Tasks state to an empty array since the component is unmounting
      }
    };
  }, [realmReference, setTasks]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <AddTaskForm onSubmit={handleAddTask} />
        {tasks.length === 0 ? (
          <IntroText />
        ) : (
          <TaskList
            tasks={tasks}
            onToggleTaskStatus={handleToggleTaskStatus}
            onDeleteTask={handleDeleteTask}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.darkBlue,
  },
  content: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
});

function AppWrapper() {
  if (!RealmProvider) {
    return null;
  }
  return (
    <RealmProvider>
      <App />
    </RealmProvider>
  );
}

export default AppWrapper;
